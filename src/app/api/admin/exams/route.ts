import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { generatePracticeText, EXAM_CATEGORIES } from '@/utils/wordLists';
import { normalizeTypingText } from '@/utils/textNormalize';

const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 3600; // matches isValidSessionStats' own bound in src/lib/validation.ts
const MAX_POINTS = 1000;

// GET: Fetch list of exams with attempt counts
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: examsSnap, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const examIds = (examsSnap || []).map((e) => e.id);

    // One batched query instead of one COUNT query per exam.
    const { data: allAttempts } = examIds.length > 0
      ? await supabase.from('exam_attempts').select('exam_id, completed_at').in('exam_id', examIds)
      : { data: [] as { exam_id: string; completed_at: string | null }[] };

    const completionsByExam = new Map<string, number>();
    for (const a of allAttempts || []) {
      if (a.completed_at) {
        completionsByExam.set(a.exam_id, (completionsByExam.get(a.exam_id) ?? 0) + 1);
      }
    }

    const exams = (examsSnap || []).map((e) => ({
      id: e.id,
      title: e.title,
      batchName: e.batch_name,
      language: e.language,
      category: e.category,
      durationSeconds: e.duration_seconds,
      textContent: e.text_content,
      points: e.points,
      deadline: new Date(e.deadline),
      createdAt: new Date(e.created_at),
      completionsCount: completionsByExam.get(e.id) ?? 0,
    }));

    return NextResponse.json({ exams });
  } catch (error) {
    console.error('Fetch admin exams error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Publish an exam for a batch
export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, batchName, language, category, durationSeconds, points, deadline, textContent } = body;

    if (!title || !batchName || !language || !category || !durationSeconds || !deadline) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const normalizedLanguage = String(language).toUpperCase();
    if (normalizedLanguage !== 'ENGLISH' && normalizedLanguage !== 'BANGLA') {
      return NextResponse.json({ error: 'language must be "English" or "Bangla"' }, { status: 400 });
    }

    const legalCategories = EXAM_CATEGORIES[normalizedLanguage as 'ENGLISH' | 'BANGLA'].map((c) => c.id);
    if (!legalCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${legalCategories.join(', ')} for ${normalizedLanguage}` },
        { status: 400 }
      );
    }

    const parsedDuration = parseInt(String(durationSeconds), 10);
    if (isNaN(parsedDuration) || parsedDuration < MIN_DURATION_SECONDS || parsedDuration > MAX_DURATION_SECONDS) {
      return NextResponse.json(
        { error: `durationSeconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}` },
        { status: 400 }
      );
    }

    const parsedPoints = parseInt(String(points ?? 0), 10);
    if (isNaN(parsedPoints) || parsedPoints < 0 || parsedPoints > MAX_POINTS) {
      return NextResponse.json({ error: `points must be between 0 and ${MAX_POINTS}` }, { status: 400 });
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'deadline must be a valid date in the future' }, { status: 400 });
    }

    // Resolved once here (not left for each student to generate their own)
    // so every student in the batch sees identical text — required for the
    // WPM/accuracy comparisons in the exam report to mean anything.
    const resolvedText = (textContent && textContent.trim().length > 0)
      ? normalizeTypingText(textContent.trim())
      : normalizeTypingText(generatePracticeText(normalizedLanguage, category, 80));

    const examId = crypto.randomUUID();
    const examData = {
      id: examId,
      title: title.trim(),
      batch_name: batchName.trim(),
      language: normalizedLanguage,
      category,
      duration_seconds: parsedDuration,
      text_content: resolvedText,
      points: parsedPoints,
      deadline: deadlineDate.toISOString(),
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from('exams').insert(examData);
    if (insertErr) throw insertErr;

    return NextResponse.json(
      { message: 'Exam published successfully', exam: examData },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create exam error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
