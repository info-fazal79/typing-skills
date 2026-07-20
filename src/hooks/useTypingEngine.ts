import { useState, useEffect, useRef, useCallback } from 'react';

export function useTypingEngine(targetText: string, durationLimitSeconds: number = 30) {
  const [typedText, setTypedText] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(durationLimitSeconds);
  const [totalAttempts, setTotalAttempts] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Reset engine — clears all state and restarts with new duration
  const resetEngine = useCallback((newDuration?: number) => {
    const dur = newDuration ?? durationLimitSeconds;
    setTypedText('');
    setIsStarted(false);
    setIsCompleted(false);
    setTimeLeft(dur);
    setTotalAttempts(0);
    startTimeRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [durationLimitSeconds]);

  // Handle typing input changes
  const handleInputChange = useCallback((value: string) => {
    if (isCompleted) return;

    // Start timer on first keystroke
    if (!isStarted && value.length > 0) {
      setIsStarted(true);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsCompleted(true);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Track total keystrokes (forward only, not backspace)
    if (value.length > typedText.length) {
      const typedChar = value[value.length - 1];
      const targetChar = targetText[typedText.length];

      setTotalAttempts((prev) => prev + 1);

      // STRICT SPACE RULE: If the target character is a space,
      // and the typed character is NOT a space, do not advance the input.
      if (targetChar === ' ' && typedChar !== ' ') {
        return;
      }
    }

    // Clamp to target length — do NOT auto-complete; rely on timer
    setTypedText(value.length > targetText.length ? value.substring(0, targetText.length) : value);
  }, [isStarted, isCompleted, typedText, targetText]);

  // Sync timeLeft when durationLimitSeconds changes before test starts
  useEffect(() => {
    if (!isStarted && !isCompleted) {
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
  let correctChars = 0;
  let incorrectChars = 0;

  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === targetText[i]) {
      correctChars++;
    } else {
      incorrectChars++;
    }
  }

  const timeElapsed = startTimeRef.current
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
  };
}
