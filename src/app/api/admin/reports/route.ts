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

    // Fetch all tasks to know task counts by batch
    const { data: allTasks } = await supabase.from('tasks').select('id, batches');
    const tasksByBatch = new Map<string, string[]>(); // batch_name -> array of task_ids
    for (const t of allTasks || []) {
      for (const b of t.batches || []) {
        const list = tasksByBatch.get(b);
        if (list) list.push(t.id);
        else tasksByBatch.set(b, [t.id]);
      }
    }

    // Fetch batch data for students
    const [sessionsResult, submissionsResult, inactivityLogsResult] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('practice_sessions').select('user_id, duration, wpm, accuracy, language').in('user_id', studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? supabase.from('task_submissions').select('user_id, task_id').in('user_id', studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? supabase.from('inactivity_logs').select('user_id, points_deducted').in('user_id', studentIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Group practice sessions by user
    const sessionsByUser = new Map<string, any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */>();
    for (const s of sessionsResult.data || []) {
      const list = sessionsByUser.get(s.user_id);
      if (list) list.push(s);
      else sessionsByUser.set(s.user_id, [s]);
    }

    // Group submissions by user
    const submissionsByUser = new Map<string, Set<string>>();
    for (const sub of submissionsResult.data || []) {
      let set = submissionsByUser.get(sub.user_id);
      if (!set) {
        set = new Set<string>();
        submissionsByUser.set(sub.user_id, set);
      }
      set.add(sub.task_id);
    }

    // Group penalties by user
    const penaltiesByUser = new Map<string, number>();
    for (const log of inactivityLogsResult.data || []) {
      const current = penaltiesByUser.get(log.user_id) ?? 0;
      penaltiesByUser.set(log.user_id, current + (log.points_deducted || 0));
    }

    const reportData = (students || []).map((student) => {
      const sessions = sessionsByUser.get(student.id) ?? [];
      const sessionCount = sessions.length;

      // Group practice time by language
      const englishSeconds = sessions
        .filter((s) => (s.language || '').toUpperCase() === 'ENGLISH')
        .reduce((sum, s) => sum + (s.duration ?? 0), 0);
      const banglaSeconds = sessions
        .filter((s) => (s.language || '').toUpperCase() === 'BANGLA')
        .reduce((sum, s) => sum + (s.duration ?? 0), 0);

      const englishMinutes = Math.round(englishSeconds / 60);
      const banglaMinutes = Math.round(banglaSeconds / 60);

      // Tasks completion rates
      const assignedTaskIds = tasksByBatch.get(student.batch_name || '') || [];
      const totalAssignedTasks = assignedTaskIds.length;
      
      const userSubs = submissionsByUser.get(student.id);
      const completedTasks = userSubs 
        ? assignedTaskIds.filter((tid) => userSubs.has(tid)).length
        : 0;

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
        englishMinutes,
        banglaMinutes,
        taskCompletions: completedTasks,
        totalAssignedTasks,
        penalties: penaltiesByUser.get(student.id) ?? 0,
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

