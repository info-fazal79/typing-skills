import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';

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

    // Apply retrospective penalties first to ensure points sync
    await applyInactivityPenalties(user.id);

    const body = await req.json();
    const { taskId, wpm, accuracy } = body;

    if (!taskId || wpm === undefined || accuracy === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Fetch the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: {
          where: { batchName: user.batchName || '' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify task is assigned to student's batch
    if (task.assignments.length === 0) {
      return NextResponse.json({ error: 'Task is not assigned to your batch' }, { status: 403 });
    }

    // Check if thresholds are met
    if (wpm < task.targetWpm || accuracy < task.targetAccuracy) {
      return NextResponse.json(
        { 
          error: `Requirements not met. You need at least ${task.targetWpm} WPM and ${task.targetAccuracy}% accuracy.`,
          wpmMet: wpm >= task.targetWpm,
          accuracyMet: accuracy >= task.targetAccuracy
        },
        { status: 400 }
      );
    }

    // Check if deadline is missed
    const now = new Date();
    const isLate = now > new Date(task.deadline);

    // Check if user has already submitted this task
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: {
        taskId_studentId: {
          taskId,
          studentId: user.id,
        },
      },
    });

    // Determine points to award
    let pointsToAward = 0;
    if (!existingSubmission) {
      // First submission
      pointsToAward = isLate ? 0 : task.pointsAwardable;
    }

    let submission;
    let updatedUserPoints = user.points;

    if (existingSubmission) {
      // Update stats if they performed better, but don't add points again
      submission = await prisma.taskSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          wpm: Math.max(existingSubmission.wpm, parseFloat(wpm)),
          accuracy: Math.max(existingSubmission.accuracy, parseFloat(accuracy)),
        },
      });
    } else {
      // Create new submission
      const [newSubmission, updatedUser] = await prisma.$transaction([
        prisma.taskSubmission.create({
          data: {
            taskId,
            studentId: user.id,
            wpm: parseFloat(wpm),
            accuracy: parseFloat(accuracy),
            pointsEarned: pointsToAward,
            isLate,
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            points: {
              increment: pointsToAward,
            },
          },
        }),
      ]);
      submission = newSubmission;
      updatedUserPoints = updatedUser.points;
    }

    return NextResponse.json({
      message: isLate 
        ? 'Task submitted successfully (Late submission, 0 points awarded)'
        : 'Task completed successfully! Points awarded.',
      pointsEarned: pointsToAward,
      newPointsTotal: updatedUserPoints,
      submission,
    });
  } catch (error: any) {
    console.error('Task submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
