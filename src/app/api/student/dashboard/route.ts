import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    // Apply retrospective penalties (non-blocking)
    try {
      await applyInactivityPenalties(user.id);
    } catch (e) {
      console.warn('Penalty application failed (non-fatal):', e);
    }

    // ── Fetch refreshed user ──────────────────────────────────────────────
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    const points = userData?.points ?? 0;
    const batchName = userData?.batch_name ?? '';

    // ── Batch targets (STUDENT only) ──────────────────────────────────────
    let targetMinutes = 5;
    let pointsDeduction = 10;
    if (batchName) {
      try {
        const { data: batchTarget } = await supabase
          .from('batch_targets')
          .select('*')
          .eq('batch_name', batchName)
          .single();
        if (batchTarget) {
          targetMinutes = batchTarget.daily_target_minutes ?? 5;
          pointsDeduction = batchTarget.points_deduction ?? 10;
        }
      } catch (e) {
        console.warn('batch_targets fetch failed (non-fatal):', e);
      }
    }

    // ── Today's practice time ─────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const dayStart = `${todayStr}T00:00:00.000Z`;
    const dayEnd = `${todayStr}T23:59:59.999Z`;

    let todaySecondsPracticed = 0;
    try {
      const { data: todaySessions } = await supabase
        .from('practice_sessions')
        .select('duration')
        .eq('user_id', user.id)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      todaySecondsPracticed = (todaySessions || []).reduce((sum, d) => sum + (d.duration ?? 0), 0);
    } catch (e) {
      console.warn('Today sessions fetch failed (non-fatal):', e);
    }

    // ── Batch task assignments (STUDENT only) ─────────────────────────────
    let formattedTasks: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] = [];
    if (batchName) {
      try {
        const { data: tasksSnap } = await supabase
          .from('tasks')
          .select('*')
          .contains('batches', [batchName]);

        const { data: submissionsSnap } = await supabase
          .from('task_submissions')
          .select('*')
          .eq('user_id', user.id);

        const submissionMap = new Map<string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */>();
        (submissionsSnap || []).forEach((s) => submissionMap.set(s.task_id, s));

        formattedTasks = (tasksSnap || [])
          .map((task) => {
            const submission = submissionMap.get(task.id);
            const deadline = new Date(task.deadline);
            const status = submission
              ? 'COMPLETED'
              : new Date() > deadline
              ? 'MISSED'
              : 'PENDING';

            return {
              id: task.id,
              title: task.title,
              textContent: task.text_content,
              language: task.language,
              targetWpm: task.target_wpm,
              targetAccuracy: task.target_accuracy,
              deadline,
              pointsAwardable: task.points_awardable,
              status,
              submission: submission
                ? {
                    wpm: submission.wpm,
                    accuracy: submission.accuracy,
                    pointsEarned: submission.points_earned,
                    completedAt: new Date(submission.created_at),
                    isLate: submission.is_late,
                  }
                : null,
            };
          })
          .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      } catch (e) {
        console.warn('Tasks fetch failed (non-fatal):', e);
      }
    }

    // ── All practice sessions for this user ─────────────────────────────
    let allSessions: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] = [];
    try {
      const { data: sessionsSnap } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      allSessions = (sessionsSnap || []).map((s) => ({
        id: s.id,
        wpm: s.wpm ?? 0,
        accuracy: s.accuracy ?? 0,
        duration: s.duration ?? 0,
        language: s.language ?? 'English',
        mode: s.mode ?? 'Standard',
        createdAtISO: s.created_at,
        createdAt: s.created_at,
      }));
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

    const recentSessions = allSessions.slice(0, 15);
    const totalDurationSeconds = allSessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const totalMinutes = Math.round(totalDurationSeconds / 60);
    const sessionHistory = [...recentSessions].reverse().map((s) => ({
      id: s.id,
      wpm: s.wpm,
      accuracy: s.accuracy,
      createdAtISO: s.createdAtISO,
    }));

    const dailyPracticeHistory: { dayName: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySeconds = allSessions
        .filter((s) => s.createdAt && s.createdAt.split('T')[0] === dateStr)
        .reduce((sum, s) => sum + s.duration, 0);
      dailyPracticeHistory.push({
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        minutes: Math.round(daySeconds / 60),
      });
    }

    let performanceTrend: 'improving' | 'stable' | 'declining' | 'new' = 'new';
    if (sessionHistory.length >= 5) {
      const half = Math.floor(sessionHistory.length / 2);
      const recentAvg = sessionHistory.slice(half).reduce((s, r) => s + r.wpm, 0) / (sessionHistory.length - half);
      const olderAvg = sessionHistory.slice(0, half).reduce((s, r) => s + r.wpm, 0) / half;
      const delta = recentAvg - olderAvg;
      if (delta > 3) performanceTrend = 'improving';
      else if (delta < -3) performanceTrend = 'declining';
      else performanceTrend = 'stable';
    }

    return NextResponse.json({
      user: {
        ...user,
        points,
        status: userData?.status ?? user.status,
        courseName: userData?.course_name ?? '',
        batchName: userData?.batch_name ?? '',
        rollNumber: userData?.roll_number ?? '',
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
        totalTests,
        bestWpm,
        avgWpm,
        avgAccuracy,
        totalMinutes,
        sessions: sessionHistory,
        dailyPractice: dailyPracticeHistory,
        recentSessions,
        performanceTrend,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({
      user: null,
      targets: { targetMinutes: 5, pointsDeduction: 10, todayMinutesPracticed: 0, todaySecondsPracticed: 0, percentComplete: 0 },
      tasks: [],
      analytics: { totalTests: 0, bestWpm: 0, avgWpm: 0, avgAccuracy: 0, sessions: [], dailyPractice: [], recentSessions: [], performanceTrend: 'new' },
      _error: (error instanceof Error ? error.message : 'Unknown error'),
    });
  }
}
