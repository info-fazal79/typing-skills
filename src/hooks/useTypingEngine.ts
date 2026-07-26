import { useState, useEffect, useRef, useCallback } from 'react';
import { normalizeTypingText } from '@/utils/textNormalize';
import { compareClusters } from '@/utils/banglaGraphemes';

export function useTypingEngine(targetText: string, durationLimitSeconds: number = 30, autoStart: boolean = false) {
  const [typedText, setTypedText] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(durationLimitSeconds);
  const [totalAttempts, setTotalAttempts] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  // Absolute wall-clock deadline, not a tick counter — a plain setInterval
  // that decrements by 1 each fire drifts (or outright stalls) the moment a
  // browser throttles background-tab timers, which is exactly the loophole
  // a timed exam can't tolerate. Anchoring to a fixed end timestamp and
  // recomputing "how much real time is left" on every tick means a missed
  // or delayed tick still reports the correct remaining time the instant it
  // does fire, instead of silently running slow.
  const endTimeRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (endTimeRef.current === null) return;
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setTimeLeft(remaining);
    if (remaining <= 0) {
      setIsCompleted(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const startTicking = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 1000);
  }, [tick]);

  // Exam mode: the clock is authoritatively started server-side the moment
  // the exam page first loads (not on the student's first keystroke, unlike
  // regular practice/tasks) — see src/app/api/exam/[examId]/route.ts. This
  // starts the same countdown immediately on mount instead of waiting for
  // input, so the on-screen timer here doesn't drift from the server's.
  useEffect(() => {
    if (autoStart && !isStarted && !isCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsStarted(true);
      startTimeRef.current = Date.now();
      endTimeRef.current = Date.now() + durationLimitSeconds * 1000;
      startTicking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exam mode only: force an immediate recompute the instant the tab
  // becomes visible/focused again, instead of waiting for the next
  // (possibly throttled) interval tick. This is what makes an exam
  // auto-submit right away if the student comes back after time's already
  // up, rather than however long the browser feels like waiting to fire a
  // background timer. Scoped to autoStart so regular practice/tasks keep
  // their existing (deliberately different) pause-on-blur behavior via
  // setPaused below, unaffected.
  useEffect(() => {
    if (!autoStart) return;
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [autoStart, tick]);

  // Reset engine — clears all state and restarts with new duration
  const resetEngine = useCallback((newDuration?: number) => {
    const dur = newDuration ?? durationLimitSeconds;
    setTypedText('');
    setIsStarted(false);
    setIsCompleted(false);
    setTimeLeft(dur);
    setTotalAttempts(0);
    startTimeRef.current = null;
    pauseStartRef.current = null;
    endTimeRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [durationLimitSeconds]);

  // Pause/resume the countdown (and shift both the elapsed-time baseline
  // and the end-time deadline on resume) so switching tabs or losing focus
  // mid-test doesn't burn down the timer or count against WPM/accuracy —
  // previously the interval kept ticking and elapsed time kept accruing
  // regardless of focus. Exam mode (autoStart) never calls this at all (see
  // TypingPractice.tsx) — an exam's timer must keep running in the
  // background precisely so it can't be paused by tabbing away.
  const setPaused = useCallback((paused: boolean) => {
    if (!isStarted || isCompleted) return;

    if (paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (pauseStartRef.current === null) {
        pauseStartRef.current = Date.now();
      }
    } else {
      if (pauseStartRef.current !== null) {
        const pausedMs = Date.now() - pauseStartRef.current;
        if (startTimeRef.current !== null) {
          startTimeRef.current += pausedMs;
        }
        if (endTimeRef.current !== null) {
          endTimeRef.current += pausedMs;
        }
        pauseStartRef.current = null;
      }
      if (!timerRef.current) {
        startTicking();
      }
    }
  }, [isStarted, isCompleted, startTicking]);

  // Handle typing input changes
  const handleInputChange = useCallback((rawValue: string) => {
    if (isCompleted) return;

    // Normalize before comparing anything against targetText — some Bangla
    // input methods (Bijoy Unicode among them) can emit a precomposed
    // nukta letter or wrap a conjunct in invisible joiners, either of which
    // would otherwise never byte-match a target string built from the same
    // normalized form. See utils/textNormalize.ts for the full rationale.
    const value = normalizeTypingText(rawValue);

    // Start timer on first keystroke
    if (!isStarted && value.length > 0) {
      setIsStarted(true);
      startTimeRef.current = Date.now();
      endTimeRef.current = Date.now() + durationLimitSeconds * 1000;
      startTicking();
    }

    // Track total keystrokes (forward only, not backspace). Gated on the RAW
    // (pre-normalization) length growing — that's the actual signal that the
    // user pressed a forward key — rather than the normalized delta, because
    // NFC normalization doesn't only expand code units (RRA/RHA/YYA, see
    // below), it also COLLAPSES them: Bangla o-kar/ou-kar are commonly typed
    // as two separate keystrokes (e-kar, then aa-kar / the AU length mark),
    // which NFC recomposes into one precomposed code unit. That second
    // keystroke leaves the normalized length unchanged (rawDelta=1,
    // normalizedDelta=0), so gating on normalizedDelta silently dropped it
    // from totalAttempts — an uncounted keystroke that inflates accuracy%
    // for any Bangla text using okar/oukar, some of the most common vowel
    // signs. Math.max(1, ...) keeps the increment amount matched to
    // correctChars/incorrectChars' code-unit scale for the expansion case
    // (RRA/RHA/YYA, where normalizedDelta=2) while guaranteeing every real
    // keystroke counts for at least 1 in the composition-collapse case.
    // Checking targetChar against the FIRST new position (not the last)
    // keeps the strict-space check correct regardless of how many code
    // units this event actually added.
    const rawDelta = rawValue.length - typedText.length;
    const normalizedDelta = value.length - typedText.length;
    if (rawDelta > 0) {
      const firstNewChar = value[typedText.length];
      const targetChar = targetText[typedText.length];

      setTotalAttempts((prev) => prev + Math.max(1, normalizedDelta));

      // STRICT SPACE RULE: If the target character is a space,
      // and the typed character is NOT a space, do not advance the input.
      if (targetChar === ' ' && firstNewChar !== ' ') {
        return;
      }
    }

    // Clamp to target length — do NOT auto-complete; rely on timer
    setTypedText(value.length > targetText.length ? value.substring(0, targetText.length) : value);
  }, [isStarted, isCompleted, typedText, targetText, startTicking, durationLimitSeconds]);

  // Sync timeLeft when durationLimitSeconds changes before test starts
  useEffect(() => {
    if (!isStarted && !isCompleted) {
      // eslint-disable-next-line
      setTimeLeft(durationLimitSeconds);
    }
  }, [durationLimitSeconds, isStarted, isCompleted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Compute live stats ─────────────────────────────────────────────────────
  // Scored per grapheme cluster (a whole Bangla conjunct, or a single code
  // unit for everything else) so a typo inside a conjunct counts the whole
  // conjunct wrong instead of just the one code unit that differs — this
  // keeps accuracy/WPM in agreement with the per-conjunct coloring shown in
  // the typing UI. No-op for English/Latin text.
  const { correctChars, incorrectChars } = compareClusters(typedText, targetText);

  // eslint-disable-next-line
  const timeElapsed = startTimeRef.current
    // eslint-disable-next-line
    ? (Date.now() - startTimeRef.current) / 1000
    : 0;

  const effectiveTime = timeElapsed > 0 ? timeElapsed : 0.001;

  // WPM = (correct chars / 5) / minutes elapsed
  const rawWpm = (correctChars / 5) / (effectiveTime / 60);
  const wpm = Math.max(0, Math.round(rawWpm));

  // Accuracy = correct keystrokes / total keystrokes
  const accuracy = totalAttempts > 0
    ? Math.min(100, Math.round((correctChars / totalAttempts) * 100))
    : 100;

  return {
    typedText,
    isStarted,
    isCompleted,
    timeLeft,
    totalAttempts,
    correctChars,
    incorrectChars,
    wpm,
    accuracy,
    timeElapsed: Math.round(effectiveTime),
    handleInputChange,
    resetEngine,
    setPaused,
  };
}
