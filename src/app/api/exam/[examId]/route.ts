import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch (and, on first load, start) a student's exam attempt.
//
// exam_attempts rows are created here — at first successful fetch, not at
// submission — so the unique(exam_id, student_id) constraint enforces "no
// retakes" from the earliest possible moment, and a mid-exam page refresh
// resumes from the same started_at instead of granting a fresh countdown.
// See scripts/sql/2026-07-26-add-exam-system.sql for the full rationale.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'STUDENT' && user.role !== 'USER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Account pending admin approval.' }, { status: 403 });
    }

    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (examErr || !exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const { data: userData } = await supabase.from('users').select('batch_name').eq('id', user.id).single();
    if ((userData?.batch_name ?? '') !== exam.batch_name) {
      return NextResponse.json({ error: 'This exam is not assigned to your batch' }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    let attempt = existing;

    if (!attempt) {
      if (Date.now() >= new Date(exam.deadline).getTime()) {
        return NextResponse.json({ error: 'This exam has expired' }, { status: 403 });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('exam_attempts')
        .insert({ id: crypto.randomUUID(), exam_id: examId, student_id: user.id })
        .select('*')
        .single();

      if (insertErr) {
        // Unique-violation: a concurrent request (two tabs) already started
        // this attempt — fetch that row instead of erroring, same race-safe
        // pattern as register/route.ts's unique-index handling.
        if (insertErr.code === '23505') {
          const { data: raced } = await supabase
            .from('exam_attempts')
            .select('*')
            .eq('exam_id', examId)
            .eq('student_id', user.id)
            .single();
          attempt = raced;
        } else {
          throw insertErr;
        }
      } else {
        attempt = inserted;
      }
    }

    if (!attempt) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (attempt.completed_at) {
      return NextResponse.json({
        status: 'COMPLETED',
        result: {
          wpm: attempt.wpm ?? 0,
          rawWpm: attempt.raw_wpm ?? 0,
          accuracy: attempt.accuracy ?? 0,
        },
      });
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const remainingSeconds = exam.duration_seconds - elapsedSeconds;

    if (remainingSeconds <= 0) {
      // Time ran out while the student was away (closed the tab, lost
      // connection, etc.) — auto-finalize with a zero score instead of
      // leaving the attempt open, which would otherwise let them come back
      // and start fresh (there's no keystroke record to score them on, so
      // zero is the only honest result here).
      await supabase
        .from('exam_attempts')
        .update({ completed_at: new Date().toISOString(), wpm: 0, raw_wpm: 0, accuracy: 0 })
        .eq('id', attempt.id);

      return NextResponse.json({
        status: 'COMPLETED',
        result: { wpm: 0, rawWpm: 0, accuracy: 0 },
        expired: true,
      });
    }

    return NextResponse.json({
      status: 'ACTIVE',
      exam: {
        id: exam.id,
        title: exam.title,
        language: exam.language,
        category: exam.category,
        textContent: exam.text_content,
        durationSeconds: exam.duration_seconds,
        points: exam.points,
      },
      remainingSeconds,
    });
  } catch (error) {
    console.error('Fetch exam error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
