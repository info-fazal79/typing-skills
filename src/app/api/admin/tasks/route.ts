import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch list of admin tasks with completions
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      include: {
        assignments: {
          select: { batchName: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      textContent: task.textContent,
      language: task.language,
      targetWpm: task.targetWpm,
      targetAccuracy: task.targetAccuracy,
      deadline: task.deadline,
      pointsAwardable: task.pointsAwardable,
      createdAt: task.createdAt,
      batches: task.assignments.map(a => a.batchName),
      completionsCount: task._count.submissions,
    }));

    return NextResponse.json({ tasks: formattedTasks });
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
    const { 
      title, 
      textContent, 
      language, 
      targetWpm, 
      targetAccuracy, 
      deadline, 
      pointsAwardable, 
      batches 
    } = body;

    // Validate parameters
    if (!title || !textContent || !language || !targetWpm || !targetAccuracy || !deadline || !batches || !Array.isArray(batches)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Create task & assignments in transaction
    const task = await prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          title: title.trim(),
          textContent: textContent.trim(),
          language: language.toUpperCase(),
          targetWpm: parseFloat(targetWpm),
          targetAccuracy: parseFloat(targetAccuracy),
          deadline: new Date(deadline),
          pointsAwardable: parseInt(pointsAwardable || 100),
          creatorId: admin.id,
        },
      });

      // Create assignments
      if (batches.length > 0) {
        await tx.taskAssignment.createMany({
          data: batches.map(batchName => ({
            taskId: newTask.id,
            batchName: batchName.trim(),
          })),
        });
      }

      return newTask;
    });

    return NextResponse.json({
      message: 'Task created and assigned successfully',
      task,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
