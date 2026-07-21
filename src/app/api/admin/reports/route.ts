import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all students
    const { data: students, error: studentsErr } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'STUDENT');

    if (studentsErr) throw studentsErr;

    const studentIds = (students || []).map((s) => s.id);

    // Two batched queries instead of two queries PER student (was 2n+1 DB
    // round trips for n students — every session/submission for the whole
    // student body fetched, then grouped in JS in a single pass each).
    const [sessionsResult, submissionsResult] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('practice_sessions').select('user_id, duration, wpm, accuracy').in('user_id', studentIds)
        : Promise.resolve({ data: [] as { user_id: string; duration: number | null; wpm: number; accuracy: number }[] }),
      studentIds.length > 0
        ? supabase.from('task_submissions').select('user_id').in('user_id', studentIds)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

    const sessionsByUser = new Map<string, { duration: number | null; wpm: number; accuracy: number }[]>();
    for (const s of sessionsResult.data || []) {
      const list = sessionsByUser.get(s.user_id);
      if (list) list.push(s);
      else sessionsByUser.set(s.user_id, [s]);
    }

    const completionsByUser = new Map<string, number>();
    for (const sub of submissionsResult.data || []) {
      completionsByUser.set(sub.user_id, (completionsByUser.get(sub.user_id) ?? 0) + 1);
    }

    const reportData = (students || []).map((student) => {
      const sessions = sessionsByUser.get(student.id) ?? [];
      const sessionCount = sessions.length;
      const totalDurationSeconds = sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
      const totalPracticeMinutes = Math.round(totalDurationSeconds / 60);
      const avgWpm =
        sessionCount > 0
          ? Math.round((sessions.reduce((sum, s) => sum + s.wpm, 0) / sessionCount) * 10) / 10
          : 0;
      const avgAccuracy =
        sessionCount > 0
          ? Math.round((sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessionCount) * 10) / 10
          : 0;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        course: student.course_name || 'N/A',
        batch: student.batch_name || 'N/A',
        rollNumber: student.roll_number || 'N/A',
        status: student.status,
        points: student.points ?? 0,
        totalSessions: sessionCount,
        averageWpm: avgWpm,
        averageAccuracy: avgAccuracy,
        totalMinutesPracticed: totalPracticeMinutes,
        taskCompletions: completionsByUser.get(student.id) ?? 0,
        joinDate: new Date(student.created_at).toLocaleDateString(),
      };
    });

    // Sort by points descending
    reportData.sort((a, b) => b.points - a.points);

    return NextResponse.json({ report: reportData });
  } catch (error) {
    console.error('Fetch student report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
