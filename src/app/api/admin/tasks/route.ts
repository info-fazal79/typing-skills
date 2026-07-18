import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch list of tasks with completion counts
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasksSnap = await db.collection('tasks').orderBy('createdAt', 'desc').get();

    const tasks = await Promise.all(
      tasksSnap.docs.map(async (doc) => {
        const t = doc.data();

        // Count submissions for this task
        const submissionsSnap = await db
          .collection('task_submissions')
          .where('taskId', '==', doc.id)
          .get();

        return {
          id: doc.id,
          title: t.title,
          textContent: t.textContent,
          language: t.language,
          targetWpm: t.targetWpm,
          targetAccuracy: t.targetAccuracy,
          deadline: t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline),
          pointsAwardable: t.pointsAwardable,
          createdAt: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt),
          batches: t.batches ?? [],
          completionsCount: submissionsSnap.size,
        };
      })
    );

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('Fetch admin tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a task and assign it to batches
export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, textContent, language, targetWpm, targetAccuracy, deadline, pointsAwardable, batches } = body;

    if (!title || !textContent || !language || !targetWpm || !targetAccuracy || !deadline || !batches || !Array.isArray(batches)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    const now = new Date();

    const taskData = {
      title: title.trim(),
      textContent: textContent.trim(),
      language: language.toUpperCase(),
      targetWpm: parseFloat(targetWpm),
      targetAccuracy: parseFloat(targetAccuracy),
      deadline: new Date(deadline),
      pointsAwardable: parseInt(pointsAwardable || 100),
      creatorId: admin.id,
      batches: batches.map((b: string) => b.trim()),
      createdAt: now,
    };

    await db.collection('tasks').doc(taskId).set(taskData);

    return NextResponse.json(
      {
        message: 'Task created and assigned successfully',
        task: { id: taskId, ...taskData },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
