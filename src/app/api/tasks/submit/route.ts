import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';
import { isValidSessionStats } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Account pending admin approval. Cannot submit tasks.' },
        { status: 403 }
      );
    }

    await applyInactivityPenalties(user.id);

    const body = await req.json();
    const { taskId, wpm, accuracy } = body;

    if (!taskId || wpm === undefined || accuracy === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (!isValidSessionStats(wpm, accuracy)) {
      return NextResponse.json({ error: 'Invalid session stats' }, { status: 400 });
    }

    // Fetch the task
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify task is assigned to student's batch
    const batches: string[] = task.batches ?? [];
    if (!batches.includes(user.batchName ?? '')) {
      return NextResponse.json({ error: 'Task is not assigned to your batch' }, { status: 403 });
    }

    // Check if thresholds are met
    if (wpm < task.target_wpm || accuracy < task.target_accuracy) {
      return NextResponse.json(
        {
          error: `Requirements not met. You need at least ${task.target_wpm} WPM and ${task.target_accuracy}% accuracy.`,
          wpmMet: wpm >= task.target_wpm,
          accuracyMet: accuracy >= task.target_accuracy,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const isLate = now > new Date(task.deadline);

    // Check for existing submission
    const { data: existingSnap } = await supabase
      .from('task_submissions')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .limit(1);

    let submissionId: string;
    let pointsToAward = 0;
    let updatedUserPoints = user.points;

    if (existingSnap && existingSnap.length > 0) {
      // Update best stats but no extra points
      const existing = existingSnap[0];
      await supabase.from('task_submissions').update({
        wpm: Math.max(existing.wpm, parseFloat(wpm)),
        accuracy: Math.max(existing.accuracy, parseFloat(accuracy)),
      }).eq('id', existing.id);
      submissionId = existing.id;
    } else {
      // First submission — award points if on time
      pointsToAward = isLate ? 0 : task.points_awardable;
      submissionId = crypto.randomUUID();

      await supabase.from('task_submissions').insert({
        id: submissionId,
        task_id: taskId,
        user_id: user.id,
        wpm: parseFloat(wpm),
        accuracy: parseFloat(accuracy),
        points_earned: pointsToAward,
        is_late: isLate,
        created_at: now.toISOString(),
      });

      if (pointsToAward > 0) {
        // Atomic increment — avoids a lost update if this user has another
        // request (a practice save, another task) awarding points at the
        // same moment.
        const { data: pointsRows, error: pointsErr } = await supabase.rpc(
          'award_task_points',
          { p_user_id: user.id, p_points_delta: pointsToAward }
        );
        if (pointsErr) throw pointsErr;
        updatedUserPoints = pointsRows?.[0]?.points ?? user.points + pointsToAward;
      }
    }

    return NextResponse.json({
      message: isLate
        ? 'Task submitted successfully (Late submission, 0 points awarded)'
        : 'Task completed successfully! Points awarded.',
      pointsEarned: pointsToAward,
      newPointsTotal: updatedUserPoints,
      submissionId,
    });
  } catch (error) {
    console.error('Task submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
