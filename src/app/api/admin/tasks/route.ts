import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch list of tasks with completion counts
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tasksSnap, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tasks = await Promise.all(
      (tasksSnap || []).map(async (t) => {
        const { count } = await supabase
          .from('task_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('task_id', t.id);

        return {
          id: t.id,
          title: t.title,
          textContent: t.text_content,
          language: t.language,
          targetWpm: t.target_wpm,
          targetAccuracy: t.target_accuracy,
          deadline: new Date(t.deadline),
          pointsAwardable: t.points_awardable,
          createdAt: new Date(t.created_at),
          batches: t.batches ?? [],
          completionsCount: count ?? 0,
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
    const now = new Date().toISOString();

    const taskData = {
      id: taskId,
      title: title.trim(),
      text_content: textContent.trim(),
      language: language.toUpperCase(),
      target_wpm: parseFloat(targetWpm),
      target_accuracy: parseFloat(targetAccuracy),
      deadline: new Date(deadline).toISOString(),
      points_awardable: parseInt(pointsAwardable || 100),
      batches: batches.map((b: string) => b.trim()),
      created_at: now,
    };

    const { error: insertErr } = await supabase.from('tasks').insert(taskData);
    if (insertErr) throw insertErr;

    return NextResponse.json(
      {
        message: 'Task created and assigned successfully',
        task: taskData,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
