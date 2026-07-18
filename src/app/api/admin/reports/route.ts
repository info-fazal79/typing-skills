import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all students and their session aggregates
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        email: true,
        courseName: true,
        batchName: true,
        rollNumber: true,
        status: true,
        points: true,
        createdAt: true,
        sessions: {
          select: {
            wpm: true,
            accuracy: true,
            duration: true,
          },
        },
        submissions: {
          select: {
            taskId: true,
            wpm: true,
            accuracy: true,
            isLate: true,
          },
        },
      },
      orderBy: { points: 'desc' },
    });

    const reportData = students.map((student) => {
      const sessionCount = student.sessions.length;
      const totalDurationSeconds = student.sessions.reduce((sum, s) => sum + s.duration, 0);
      const totalPracticeMinutes = Math.round(totalDurationSeconds / 60);

      // Average speed and accuracy
      const avgWpm = sessionCount > 0
        ? Math.round(student.sessions.reduce((sum, s) => sum + s.wpm, 0) / sessionCount * 10) / 10
        : 0;

      const avgAccuracy = sessionCount > 0
        ? Math.round(student.sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessionCount * 10) / 10
        : 0;

      const taskCompletions = student.submissions.length;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        course: student.courseName || 'N/A',
        batch: student.batchName || 'N/A',
        rollNumber: student.rollNumber || 'N/A',
        status: student.status,
        points: student.points,
        totalSessions: sessionCount,
        averageWpm: avgWpm,
        averageAccuracy: avgAccuracy,
        totalMinutesPracticed: totalPracticeMinutes,
        taskCompletions: taskCompletions,
        joinDate: new Date(student.createdAt).toLocaleDateString(),
      };
    });

    return NextResponse.json({ report: reportData });
  } catch (error: any) {
    console.error('Fetch student report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
