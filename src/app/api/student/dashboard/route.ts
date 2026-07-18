import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Apply retrospective penalties
    await applyInactivityPenalties(user.id);

    // Fetch refreshed user
    const userDoc = await db.collection('users').doc(user.id).get();
    const userData = userDoc.data()!;
    const points = userData.points ?? 0;
    const batchName = userData.batchName ?? '';

    // Get batch targets
    let targetMinutes = 5;
    let pointsDeduction = 10;
    if (batchName) {
      const batchDoc = await db.collection('batch_targets').doc(batchName).get();
      if (batchDoc.exists) {
        targetMinutes = batchDoc.data()!.dailyTargetMinutes ?? 5;
        pointsDeduction = batchDoc.data()!.pointsDeduction ?? 10;
      }
    }

    // Today's practice time
    const todayStr = new Date().toISOString().split('T')[0];
    const dayStart = new Date(`${todayStr}T00:00:00`);
    const dayEnd = new Date(`${todayStr}T23:59:59.999`);

    const todaySessionsSnap = await db
      .collection('practice_sessions')
      .where('userId', '==', user.id)
      .where('createdAt', '>=', dayStart)
      .where('createdAt', '<=', dayEnd)
      .get();

    const todaySecondsPracticed = todaySessionsSnap.docs.reduce(
      (sum, d) => sum + (d.data().duration ?? 0),
      0
    );

    // Tasks assigned to the user's batch
    const tasksSnap = await db
      .collection('tasks')
      .where('batches', 'array-contains', batchName)
      .orderBy('deadline', 'asc')
      .get();

    // Fetch submissions for this user
    const submissionsSnap = await db
      .collection('task_submissions')
      .where('studentId', '==', user.id)
      .get();

    const submissionMap = new Map<string, any>();
    submissionsSnap.docs.forEach((doc) => {
      const d = doc.data();
      submissionMap.set(d.taskId, d);
    });

    const formattedTasks = tasksSnap.docs.map((doc) => {
      const task = doc.data();
      const submission = submissionMap.get(doc.id);
      const deadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
      const status = submission
        ? 'COMPLETED'
        : new Date() > deadline
        ? 'MISSED'
        : 'PENDING';

      return {
        id: doc.id,
        title: task.title,
        textContent: task.textContent,
        language: task.language,
        targetWpm: task.targetWpm,
        targetAccuracy: task.targetAccuracy,
        deadline,
        pointsAwardable: task.pointsAwardable,
        status,
        submission: submission
          ? {
              wpm: submission.wpm,
              accuracy: submission.accuracy,
              pointsEarned: submission.pointsEarned,
              completedAt: submission.completedAt?.toDate
                ? submission.completedAt.toDate()
                : new Date(submission.completedAt),
              isLate: submission.isLate,
            }
          : null,
      };
    });

    // Recent 15 sessions for WPM/accuracy trend chart
    const recentSessionsSnap = await db
      .collection('practice_sessions')
      .where('userId', '==', user.id)
      .orderBy('createdAt', 'desc')
      .limit(15)
      .get();

    const sessionHistory = recentSessionsSnap.docs
      .reverse()
      .map((doc) => {
        const s = doc.data();
        const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return {
          id: doc.id,
          wpm: s.wpm,
          accuracy: s.accuracy,
          date: createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        };
      });

    // Daily practice minutes for last 7 days
    const dailyPracticeHistory = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const start = new Date(`${dateStr}T00:00:00`);
      const end = new Date(`${dateStr}T23:59:59.999`);

      const daySnap = await db
        .collection('practice_sessions')
        .where('userId', '==', user.id)
        .where('createdAt', '>=', start)
        .where('createdAt', '<=', end)
        .get();

      const minutesPracticed = Math.round(
        daySnap.docs.reduce((sum, s) => sum + (s.data().duration ?? 0), 0) / 60
      );

      dailyPracticeHistory.push({
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        minutes: minutesPracticed,
      });
    }

    return NextResponse.json({
      user: { ...user, points },
      targets: {
        targetMinutes,
        pointsDeduction,
        todayMinutesPracticed: Math.round(todaySecondsPracticed / 60),
        todaySecondsPracticed,
        percentComplete: Math.min(
          100,
          Math.round((todaySecondsPracticed / (targetMinutes * 60)) * 100)
        ),
      },
      tasks: formattedTasks,
      analytics: {
        sessions: sessionHistory,
        dailyPractice: dailyPracticeHistory,
      },
    });
  } catch (error: any) {
    console.error('Student dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
