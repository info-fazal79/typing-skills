import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all students
    const studentsSnap = await db
      .collection('users')
      .where('role', '==', 'STUDENT')
      .get();

    const reportData = await Promise.all(
      studentsSnap.docs.map(async (doc) => {
        const student = doc.data();

        // Fetch all practice sessions for this student
        const sessionsSnap = await db
          .collection('practice_sessions')
          .where('userId', '==', doc.id)
          .get();

        const sessions = sessionsSnap.docs.map((s) => s.data());
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

        // Count task submissions
        const submissionsSnap = await db
          .collection('task_submissions')
          .where('studentId', '==', doc.id)
          .get();

        const createdAt = student.createdAt?.toDate
          ? student.createdAt.toDate()
          : new Date(student.createdAt);

        return {
          id: doc.id,
          name: student.name,
          email: student.email,
          course: student.courseName || 'N/A',
          batch: student.batchName || 'N/A',
          rollNumber: student.rollNumber || 'N/A',
          status: student.status,
          points: student.points ?? 0,
          totalSessions: sessionCount,
          averageWpm: avgWpm,
          averageAccuracy: avgAccuracy,
          totalMinutesPracticed: totalPracticeMinutes,
          taskCompletions: submissionsSnap.size,
          joinDate: createdAt.toLocaleDateString(),
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
