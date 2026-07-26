import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

// GET ?examId=...: Per-student attempt status/metrics for one exam, scoped
// to the batch it was assigned to — backs the admin Student Report tab's
// exam sub-section and its CSV export.
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    if (!examId) {
      return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
    }

    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (examErr || !exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const { data: batchStudents, error: studentsErr } = await supabase
      .from('users')
      .select('id, name, roll_number')
      .eq('batch_name', exam.batch_name)
      .neq('role', 'ADMIN');

    if (studentsErr) throw studentsErr;

    const studentIds = (batchStudents || []).map((s) => s.id);

    const { data: attempts } = studentIds.length > 0
      ? await supabase.from('exam_attempts').select('*').eq('exam_id', examId).in('student_id', studentIds)
      : { data: [] as { student_id: string; wpm: number | null; raw_wpm: number | null; accuracy: number | null; points_earned: number | null; completed_at: string | null }[] };

    const attemptByStudent = new Map((attempts || []).map((a) => [a.student_id, a]));

    const rows = (batchStudents || []).map((s) => {
      const attempt = attemptByStudent.get(s.id);
      const completed = !!attempt?.completed_at;
      return {
        studentId: s.id,
        name: s.name,
        rollNumber: s.roll_number || 'N/A',
        status: completed ? 'COMPLETED' : 'NOT_ATTEMPTED',
        wpm: completed ? (attempt?.wpm ?? 0) : null,
        rawWpm: completed ? (attempt?.raw_wpm ?? 0) : null,
        accuracy: completed ? (attempt?.accuracy ?? 0) : null,
        pointsEarned: completed ? (attempt?.points_earned !== null && attempt?.points_earned !== undefined ? attempt.points_earned : exam.points) : 0,
        completedAt: completed ? attempt?.completed_at : null,
      };
    });

    rows.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        batchName: exam.batch_name,
        points: exam.points,
        deadline: new Date(exam.deadline),
      },
      report: rows,
    });
  } catch (error) {
    console.error('Fetch exam report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
