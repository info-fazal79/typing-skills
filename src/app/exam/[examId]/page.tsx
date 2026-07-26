'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TypingPractice } from '@/components/TypingPractice';
import { useToast } from '@/components/ToastProvider';
import { ShieldAlert, Trophy } from 'lucide-react';

interface ExamData {
  id: string;
  title: string;
  language: string;
  category: string;
  textContent: string;
  durationSeconds: number;
  points: number;
}

interface ExamResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
}

function formatHMS(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function SiteFooter() {
  return (
    <footer className="w-full border-t border-neutral-900 py-6 text-center text-neutral-600 text-[11px] bg-neutral-950/20">
      &copy; {new Date().getFullYear()} Typing Institute. developed by{' '}
      <a href="https://www.muhammadfazal.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-400 transition-colors">
        Muhammad Fazal
      </a>
      {' '}and{' '}
      <a href="https://zihadhasan.web.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-400 transition-colors">
        Zihad Hasan
      </a>
    </footer>
  );
}

// Single-shot exam workspace. The site's normal header/footer stay in
// place (Navbar is global via the root layout) — only the config bar and
// every restart affordance are stripped out, via TypingPractice's
// `examMode` prop. All the actual anti-retake / resume enforcement lives
// server-side in /api/exam/[examId] (GET) and its submit route; this page
// just renders whatever state that endpoint says it's in.
export default function ExamPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId as string;
  const router = useRouter();
  const { showError } = useToast();

  const [phase, setPhase] = useState<'loading' | 'active' | 'completed'>('loading');
  const [exam, setExam] = useState<ExamData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [submitStatus, setSubmitStatus] = useState('');

  // Purely a display concern — this big clock and TypingPractice's own
  // internal countdown are computed independently, but both anchor to an
  // absolute end timestamp taken from the same server-provided
  // remainingSeconds within milliseconds of each other, so they stay in
  // sync without one driving the other. Recomputed from Date.now() on every
  // tick (and forced on visibility/focus) rather than decremented, so it
  // can't drift or stall the way a plain setInterval counter would when the
  // tab is backgrounded — see useTypingEngine.ts for the same pattern
  // applied to the timer that actually ends the exam.
  const examEndTimeRef = useRef<number | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/exam/${examId}`);
        const json = await res.json();
        if (cancelled) return;

        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) {
          showError(json.error || 'Unable to load this exam.');
          router.push('/dashboard');
          return;
        }
        if (json.status === 'COMPLETED') {
          setResult(json.result);
          setPhase('completed');
          setTimeout(() => router.push('/dashboard'), 3000);
          return;
        }

        setExam(json.exam);
        setRemainingSeconds(json.remainingSeconds);
        examEndTimeRef.current = Date.now() + json.remainingSeconds * 1000;
        setDisplaySeconds(json.remainingSeconds);
        setPhase('active');
      } catch {
        if (cancelled) return;
        showError('Network error loading exam.');
        router.push('/dashboard');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Big HH:MM:SS display — timestamp-anchored so it stays correct even if
  // the tab is backgrounded and the browser throttles this interval.
  useEffect(() => {
    if (phase !== 'active' || examEndTimeRef.current === null) return;

    const recompute = () => {
      if (examEndTimeRef.current === null) return;
      setDisplaySeconds(Math.max(0, Math.ceil((examEndTimeRef.current - Date.now()) / 1000)));
    };

    recompute();
    const id = setInterval(recompute, 1000);
    document.addEventListener('visibilitychange', recompute);
    window.addEventListener('focus', recompute);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', recompute);
      window.removeEventListener('focus', recompute);
    };
  }, [phase]);

  const handleExamSessionComplete = useCallback(async (stats: { wpm: number; rawWpm: number; accuracy: number }) => {
    // Swap away from TypingPractice immediately — an exam has no results
    // screen of its own to show while the submission is in flight.
    setResult(stats);
    setPhase('completed');
    setSubmitStatus('Submitting your exam…');

    try {
      const res = await fetch(`/api/exam/${examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpm: stats.wpm, rawWpm: stats.rawWpm, accuracy: stats.accuracy }),
      });
      const json = await res.json();
      setSubmitStatus(res.ok ? `Exam submitted — +${json.pointsEarned} points earned.` : (json.error || 'Failed to submit exam.'));
    } catch {
      setSubmitStatus('Network error submitting exam. Your result may not have been recorded.');
    } finally {
      setTimeout(() => router.push('/dashboard'), 3000);
    }
  }, [examId, router]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-brand-400 border-r-2 border-transparent" />
          <span className="text-neutral-500 text-sm font-medium">Loading exam…</span>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
            <Trophy size={48} className="text-brand-400" />
            <h1 className="text-2xl font-black text-neutral-100">Exam Completed</h1>
            {result && (
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-surface/40 border border-neutral-800 p-4 rounded-xl">
                  <span className="text-neutral-500 text-xs uppercase tracking-wider">WPM</span>
                  <p className="text-2xl font-bold font-mono text-brand-400">{Math.round(result.wpm)}</p>
                </div>
                <div className="bg-surface/40 border border-neutral-800 p-4 rounded-xl">
                  <span className="text-neutral-500 text-xs uppercase tracking-wider">Accuracy</span>
                  <p className="text-2xl font-bold font-mono text-neutral-200">{Math.round(result.accuracy)}%</p>
                </div>
              </div>
            )}
            <p className="text-neutral-400 text-sm">{submitStatus || 'Redirecting to your dashboard…'}</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
            <ShieldAlert className="text-brand-500 shrink-0" size={22} />
            <div>
              <span className="text-[11px] font-bold text-brand-500 uppercase tracking-widest">Exam In Progress — Single Attempt</span>
              <h1 className="text-xl font-bold text-neutral-100 leading-tight">{exam.title}</h1>
            </div>
          </div>

          {/* Large countdown — see the timestamp-anchored effect above */}
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Time Remaining</span>
            <span
              className={`font-mono text-5xl sm:text-6xl font-black tracking-wider tabular-nums ${
                displaySeconds <= 30 ? 'text-red-400' : 'text-brand-400'
              }`}
            >
              {formatHMS(displaySeconds)}
            </span>
          </div>

          <TypingPractice
            initialText={exam.textContent}
            isTask={true}
            examMode={true}
            language={exam.language}
            initialDuration={remainingSeconds}
            onSessionComplete={handleExamSessionComplete}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
