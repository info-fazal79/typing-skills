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

    const reportData = await Promise.all(
      (students || []).map(async (student) => {
        // Fetch all practice sessions for this student
        const { data: sessions } = await supabase
          .from('practice_sessions')
          .select('duration, wpm, accuracy')
          .eq('user_id', student.id);

        const sessionCount = (sessions || []).length;
        const totalDurationSeconds = (sessions || []).reduce((sum, s) => sum + (s.duration ?? 0), 0);
        const totalPracticeMinutes = Math.round(totalDurationSeconds / 60);
        const avgWpm =
          sessionCount > 0
            ? Math.round(((sessions || []).reduce((sum, s) => sum + s.wpm, 0) / sessionCount) * 10) / 10
            : 0;
        const avgAccuracy =
          sessionCount > 0
            ? Math.round(((sessions || []).reduce((sum, s) => sum + s.accuracy, 0) / sessionCount) * 10) / 10
            : 0;

        // Count task submissions
        const { count: taskCompletions } = await supabase
          .from('task_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', student.id);

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
          taskCompletions: taskCompletions ?? 0,
          joinDate: new Date(student.created_at).toLocaleDateString(),
        };
      })
    );

    // Sort by points descending
    reportData.sort((a, b) => b.points - a.points);

    return NextResponse.json({ report: reportData });
  } catch (error: any) {
    console.error('Fetch student report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
