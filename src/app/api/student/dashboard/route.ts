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

    if (user.role !== 'STUDENT' && user.role !== 'USER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Apply retrospective penalties (non-blocking — don't let this crash the whole route)
    try {
      await applyInactivityPenalties(user.id);
    } catch (e) {
      console.warn('Penalty application failed (non-fatal):', e);
    }

    // ── Fetch refreshed user ──────────────────────────────────────────────
    const userDoc = await db.collection('users').doc(user.id).get();
    const userData = userDoc.data() ?? {};
    const points = userData.points ?? 0;
    const batchName = userData.batchName ?? '';

    // ── Batch targets (STUDENT only) ──────────────────────────────────────
    let targetMinutes = 5;
    let pointsDeduction = 10;
    if (batchName) {
      try {
        const batchDoc = await db.collection('batch_targets').doc(batchName).get();
        if (batchDoc.exists) {
          targetMinutes = batchDoc.data()!.dailyTargetMinutes ?? 5;
          pointsDeduction = batchDoc.data()!.pointsDeduction ?? 10;
        }
      } catch (e) {
        console.warn('batch_targets fetch failed (non-fatal):', e);
      }
    }

    // ── Today's practice time ─────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const dayStart = new Date(`${todayStr}T00:00:00`);
    const dayEnd = new Date(`${todayStr}T23:59:59.999`);

    let todaySecondsPracticed = 0;
    try {
      const todaySessionsSnap = await db
        .collection('practice_sessions')
        .where('userId', '==', user.id)
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<=', dayEnd)
        .get();
      todaySecondsPracticed = todaySessionsSnap.docs.reduce(
        (sum, d) => sum + (d.data().duration ?? 0),
        0
      );
    } catch (e) {
      console.warn('Today sessions fetch failed (non-fatal):', e);
    }

    // ── Batch task assignments (STUDENT only) ─────────────────────────────
    let formattedTasks: any[] = [];
    if (batchName) {
      try {
        // fetch tasks without orderBy to avoid composite index requirement,
        // then sort in-memory
        const tasksSnap = await db
          .collection('tasks')
          .where('batches', 'array-contains', batchName)
          .get();

        const submissionsSnap = await db
          .collection('task_submissions')
          .where('studentId', '==', user.id)
          .get();

        const submissionMap = new Map<string, any>();
        submissionsSnap.docs.forEach((doc) => {
          const d = doc.data();
          submissionMap.set(d.taskId, d);
        });

        formattedTasks = tasksSnap.docs
          .map((doc) => {
            const task = doc.data();
            const submission = submissionMap.get(doc.id);
            const deadline = task.deadline?.toDate
              ? task.deadline.toDate()
              : new Date(task.deadline);
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
          })
          // Sort in-memory by deadline ascending (replaces orderBy to avoid index)
          .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      } catch (e) {
        console.warn('Tasks fetch failed (non-fatal):', e);
      }
    }

    // ── All practice sessions for this user (fetch once, derive everything) ─
    let allSessions: any[] = [];
    try {
      const allSessionsSnap = await db
        .collection('practice_sessions')
        .where('userId', '==', user.id)
        .get();

      allSessions = allSessionsSnap.docs.map((doc) => {
        const s = doc.data();
        let createdAt: Date;
        if (s.createdAt?.toDate) {
          createdAt = s.createdAt.toDate();
        } else if (s.createdAt) {
          createdAt = new Date(s.createdAt);
        } else {
          createdAt = new Date();
        }

        return {
          id: doc.id,
          wpm: s.wpm ?? 0,
          accuracy: s.accuracy ?? 0,
          duration: s.duration ?? 0,
          language: s.language ?? 'English',
          mode: s.mode ?? 'Standard',
          // Send raw UTC ISO string — the browser will format it in the user's local timezone
          createdAtISO: !isNaN(createdAt.getTime()) ? createdAt.toISOString() : null,
          createdAt: createdAt.toISOString(), // keep for sort (serialisable)
        };
      });

      // Sort in-memory (newest first) — createdAt is now an ISO string
      allSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.warn('All sessions fetch failed (non-fatal):', e);
    }

    // ── Derived analytics ─────────────────────────────────────────────────
    const totalTests = allSessions.length;
    const bestWpm = totalTests > 0 ? Math.max(...allSessions.map((s) => s.wpm)) : 0;
    const avgWpm =
      totalTests > 0
        ? Math.round(allSessions.reduce((sum, s) => sum + s.wpm, 0) / totalTests)
        : 0;
    const avgAccuracy =
      totalTests > 0
        ? Math.round(allSessions.reduce((sum, s) => sum + s.accuracy, 0) / totalTests)
        : 0;

    // Recent 15 for history table (already sorted newest-first)
    const recentSessions = allSessions.slice(0, 15);

    // WPM trend data (last 15, chronological)
    const sessionHistory = [...recentSessions].reverse().map((s) => ({
      id: s.id,
      wpm: s.wpm,
      accuracy: s.accuracy,
      createdAtISO: s.createdAtISO,
    }));

    // Daily practice minutes — last 7 days (in-memory from allSessions)
    const dailyPracticeHistory: { dayName: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySeconds = allSessions
        .filter((s) => {
          try {
            return s.createdAt && s.createdAt.split('T')[0] === dateStr;
          } catch {
            return false;
          }
        })
        .reduce((sum, s) => sum + s.duration, 0);
      dailyPracticeHistory.push({
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        minutes: Math.round(daySeconds / 60),
      });
    }

    // Simple performance trend label
    let performanceTrend: 'improving' | 'stable' | 'declining' | 'new' = 'new';
    if (sessionHistory.length >= 5) {
      const half = Math.floor(sessionHistory.length / 2);
      const recentAvg =
        sessionHistory.slice(half).reduce((s, r) => s + r.wpm, 0) /
        (sessionHistory.length - half);
      const olderAvg =
        sessionHistory.slice(0, half).reduce((s, r) => s + r.wpm, 0) / half;
      const delta = recentAvg - olderAvg;
      if (delta > 3) performanceTrend = 'improving';
      else if (delta < -3) performanceTrend = 'declining';
      else performanceTrend = 'stable';
    }

    return NextResponse.json({
      user: { 
        ...user, 
        points,
        status: userData.status ?? user.status,
        courseName: userData.courseName ?? '',
        batchName: userData.batchName ?? '',
        rollNumber: userData.rollNumber ?? '',
      },
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
        totalTests,
        bestWpm,
        avgWpm,
        avgAccuracy,
        sessions: sessionHistory,
        dailyPractice: dailyPracticeHistory,
        recentSessions,
        performanceTrend,
      },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    // Return safe empty structure instead of a 500 crash
    return NextResponse.json({
      user: null,
      targets: {
        targetMinutes: 5,
        pointsDeduction: 10,
        todayMinutesPracticed: 0,
        todaySecondsPracticed: 0,
        percentComplete: 0,
      },
      tasks: [],
      analytics: {
        totalTests: 0,
        bestWpm: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        sessions: [],
        dailyPractice: [],
        recentSessions: [],
        performanceTrend: 'new',
      },
      _error: error?.message ?? 'Unknown error',
    });
  }
}
