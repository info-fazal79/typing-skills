'use client';

import React, { useCallback, useEffect, useState } from 'react';
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

// Distraction-free, single-shot exam workspace. No navbar (Navbar.tsx hides
// itself on /exam/ routes), no footer, no config bar, no way to restart —
// see TypingPractice's `examMode` prop. All the actual anti-retake / resume
// enforcement lives server-side in /api/exam/[examId] (GET) and its submit
// route; this page just renders whatever state that endpoint says it's in.
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
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-brand-400 border-r-2 border-transparent" />
          <span className="text-neutral-500 text-sm font-medium">Loading exam…</span>
        </div>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="flex-1 max-w-md mx-auto flex flex-col items-center justify-center gap-4 text-center px-4">
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
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4 sm:px-6 py-10 flex-1">
        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
          <ShieldAlert className="text-brand-500 shrink-0" size={22} />
          <div>
            <span className="text-[11px] font-bold text-brand-500 uppercase tracking-widest">Exam In Progress — Single Attempt</span>
            <h1 className="text-xl font-bold text-neutral-100 leading-tight">{exam.title}</h1>
          </div>
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
    </div>
  );
}
