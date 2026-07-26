import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { isValidSessionStats } from '@/lib/validation';

// POST: Finalize a student's in-progress exam attempt. Never trusts the
// client's own idea of whether it's allowed to submit — re-verifies the
// session, batch membership, and that an in-progress (not already
// completed) attempt row actually exists before writing anything.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Account pending admin approval.' }, { status: 403 });
    }

    const body = await req.json();
    const { wpm, rawWpm, accuracy } = body;

    if (!isValidSessionStats(wpm, accuracy) || !isValidSessionStats(rawWpm ?? wpm, accuracy)) {
      return NextResponse.json({ error: 'Invalid session stats' }, { status: 400 });
    }

    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (examErr || !exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const { data: userData } = await supabase.from('users').select('batch_name, points').eq('id', user.id).single();
    if ((userData?.batch_name ?? '') !== exam.batch_name) {
      return NextResponse.json({ error: 'This exam is not assigned to your batch' }, { status: 403 });
    }

    const { data: attempt, error: attemptErr } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .single();

    if (attemptErr || !attempt) {
      return NextResponse.json({ error: 'No in-progress attempt found for this exam' }, { status: 404 });
    }
    if (attempt.completed_at) {
      return NextResponse.json({ error: 'This exam has already been submitted' }, { status: 409 });
    }

    const studentWpm = parseFloat(wpm);
    const studentAccuracy = parseFloat(accuracy);
    const speedFactor = Math.min(studentWpm / 30, 1);
    const accuracyFactor = Math.min(studentAccuracy / 90, 1);
    const calculatedScore = Math.max(0, Math.min(Math.round(exam.points * speedFactor * accuracyFactor), exam.points));

    const { error: updateErr } = await supabase
      .from('exam_attempts')
      .update({
        wpm: studentWpm,
        raw_wpm: parseFloat(rawWpm ?? wpm),
        accuracy: studentAccuracy,
        points_earned: calculatedScore,
        completed_at: new Date().toISOString(),
      })
      .eq('id', attempt.id);

    if (updateErr) throw updateErr;

    let updatedPoints = userData?.points ?? user.points;
    if (calculatedScore > 0) {
      const { data: pointsRows, error: pointsErr } = await supabase.rpc(
        'award_task_points',
        { p_user_id: user.id, p_points_delta: calculatedScore }
      );
      if (pointsErr) throw pointsErr;
      updatedPoints = pointsRows?.[0]?.points ?? updatedPoints + calculatedScore;
    }

    return NextResponse.json({
      message: 'Exam submitted successfully',
      pointsEarned: calculatedScore,
      newPointsTotal: updatedPoints,
    });
  } catch (error) {
    console.error('Exam submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
