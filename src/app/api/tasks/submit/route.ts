import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Fetch the task
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDoc.data()!;

    // Verify task is assigned to student's batch
    const batches: string[] = task.batches ?? [];
    if (!batches.includes(user.batchName ?? '')) {
      return NextResponse.json({ error: 'Task is not assigned to your batch' }, { status: 403 });
    }

    // Check if thresholds are met
    if (wpm < task.targetWpm || accuracy < task.targetAccuracy) {
      return NextResponse.json(
        {
          error: `Requirements not met. You need at least ${task.targetWpm} WPM and ${task.targetAccuracy}% accuracy.`,
          wpmMet: wpm >= task.targetWpm,
          accuracyMet: accuracy >= task.targetAccuracy,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const isLate = now > task.deadline.toDate();

    // Check for existing submission
    const existingSnap = await db
      .collection('task_submissions')
      .where('taskId', '==', taskId)
      .where('studentId', '==', user.id)
      .limit(1)
      .get();

    let submissionId: string;
    let pointsToAward = 0;
    let updatedUserPoints = user.points;

    if (!existingSnap.empty) {
      // Update best stats but no extra points
      const existingDoc = existingSnap.docs[0];
      const existing = existingDoc.data();
      await db.collection('task_submissions').doc(existingDoc.id).update({
        wpm: Math.max(existing.wpm, parseFloat(wpm)),
        accuracy: Math.max(existing.accuracy, parseFloat(accuracy)),
        updatedAt: now,
      });
      submissionId = existingDoc.id;
    } else {
      // First submission — award points if on time
      pointsToAward = isLate ? 0 : task.pointsAwardable;
      submissionId = crypto.randomUUID();

      const firestoreBatch = db.batch();
      firestoreBatch.set(db.collection('task_submissions').doc(submissionId), {
        taskId,
        studentId: user.id,
        wpm: parseFloat(wpm),
        accuracy: parseFloat(accuracy),
        pointsEarned: pointsToAward,
        isLate,
        completedAt: now,
      });
      if (pointsToAward > 0) {
        firestoreBatch.update(db.collection('users').doc(user.id), {
          points: FieldValue.increment(pointsToAward),
          updatedAt: now,
        });
      }
      await firestoreBatch.commit();

      // Get updated points
      const updatedUser = await db.collection('users').doc(user.id).get();
      updatedUserPoints = updatedUser.data()?.points ?? user.points + pointsToAward;
    }

    return NextResponse.json({
      message: isLate
        ? 'Task submitted successfully (Late submission, 0 points awarded)'
        : 'Task completed successfully! Points awarded.',
      pointsEarned: pointsToAward,
      newPointsTotal: updatedUserPoints,
      submissionId,
    });
  } catch (error: any) {
    console.error('Task submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
