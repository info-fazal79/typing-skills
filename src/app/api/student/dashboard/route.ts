import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

    // Fetch refreshed user points
    const refreshedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { points: true, batchName: true, createdAt: true },
    });

    const points = refreshedUser?.points ?? 0;
    const batchName = refreshedUser?.batchName ?? '';

    // Get batch targets
    let targetMinutes = 5;
    let pointsDeduction = 10;
    if (batchName) {
      const target = await prisma.batchTarget.findUnique({
        where: { batchName },
      });
      if (target) {
        targetMinutes = target.dailyTargetMinutes;
        pointsDeduction = target.pointsDeduction;
      }
    }

    // Get today's total practice time
    const todayStr = new Date().toISOString().split('T')[0];
    const dayStart = new Date(`${todayStr}T00:00:00`);
    const dayEnd = new Date(`${todayStr}T23:59:59.999`);

    const todaySessions = await prisma.practiceSession.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { duration: true },
    });
    const todaySecondsPracticed = todaySessions.reduce((sum, s) => sum + s.duration, 0);

    // Get tasks assigned to user's batch
    const tasks = await prisma.task.findMany({
      where: {
        assignments: {
          some: { batchName },
        },
      },
      include: {
        submissions: {
          where: { studentId: user.id },
        },
      },
      orderBy: { deadline: 'asc' },
    });

    // Format tasks
    const formattedTasks = tasks.map((task) => {
      const submission = task.submissions[0];
      const status = submission 
        ? 'COMPLETED' 
        : new Date() > new Date(task.deadline) 
          ? 'MISSED' 
          : 'PENDING';
      
      return {
        id: task.id,
        title: task.title,
        textContent: task.textContent,
        language: task.language,
        targetWpm: task.targetWpm,
        targetAccuracy: task.targetAccuracy,
        deadline: task.deadline,
        pointsAwardable: task.pointsAwardable,
        status,
        submission: submission ? {
          wpm: submission.wpm,
          accuracy: submission.accuracy,
          pointsEarned: submission.pointsEarned,
          completedAt: submission.completedAt,
          isLate: submission.isLate,
        } : null,
      };
    });

    // Analytics: recent 15 sessions for WPM/accuracy trend
    const recentSessions = await prisma.practiceSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    // Reverse to chronological order
    const sessionHistory = recentSessions.reverse().map((s) => ({
      id: s.id,
      wpm: s.wpm,
      accuracy: s.accuracy,
      date: new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));

    // Analytics: Practice seconds per day for last 7 days
    const dailyPracticeHistory = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const start = new Date(`${dateStr}T00:00:00`);
      const end = new Date(`${dateStr}T23:59:59.999`);

      const daySessions = await prisma.practiceSession.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: start, lte: end },
        },
        select: { duration: true },
      });
      const minutesPracticed = Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 60);
      dailyPracticeHistory.push({
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        minutes: minutesPracticed,
      });
    }

    return NextResponse.json({
      user: {
        ...user,
        points,
      },
      targets: {
        targetMinutes,
        pointsDeduction,
        todayMinutesPracticed: Math.round(todaySecondsPracticed / 60),
        todaySecondsPracticed,
        percentComplete: Math.min(100, Math.round((todaySecondsPracticed / (targetMinutes * 60)) * 100)),
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
