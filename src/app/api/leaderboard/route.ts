import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterBatch = searchParams.get('batch');
    const filterCourse = searchParams.get('course');

    // ── 1. Fetch metadata (courses → batches map) ────────────────────────────
    let coursesMap: Record<string, string[]> = {};
    try {
      const { data: meta } = await supabase
        .from('metadata')
        .select('courses_json')
        .eq('id', 'selectors')
        .single();
      if (meta?.courses_json) coursesMap = meta.courses_json;
    } catch (e) {
      console.warn('Failed to fetch metadata', e);
    }

    // ── 2. General Leaderboard ─────────────────────────────────────────────
    const { data: generalSnap } = await supabase
      .from('users')
      .select('id, name, role, course_name, batch_name, points, best_wpm, avg_wpm, slug')
      .eq('status', 'APPROVED');

    const general = (generalSnap || [])
      .map((d) => ({
        id: d.id,
        name: d.name,
        role: d.role ?? 'USER',
        courseName: d.course_name ?? '',
        batchName: d.batch_name ?? '',
        points: d.points ?? 0,
        bestWpm: d.best_wpm ?? 0,
        avgWpm: d.avg_wpm ?? 0,
        slug: d.slug ?? null,
      }))
      .sort((a, b) => b.points - a.points || b.bestWpm - a.bestWpm)
      .slice(0, 100);

    // ── 3. Batch Leaderboard ───────────────────────────────────────────────
    const { data: allStudentsSnap } = await supabase
      .from('users')
      .select('id, name, course_name, batch_name, roll_number, points, best_wpm, avg_wpm, slug')
      .eq('status', 'APPROVED')
      .eq('role', 'STUDENT');

    const allStudents = (allStudentsSnap || []).map((d) => ({
      id: d.id,
      name: d.name,
      courseName: d.course_name ?? '',
      batchName: d.batch_name ?? '',
      slug: d.slug ?? null,
      rollNumber: d.roll_number ?? '',
      points: d.points ?? 0,
      bestWpm: d.best_wpm ?? 0,
      avgWpm: d.avg_wpm ?? 0,
    }));

    const defaultBatch =
      filterBatch ||
      (user.role === 'STUDENT' ? user.batchName ?? '' : '') ||
      '';

    let filteredStudents = allStudents;
    if (defaultBatch) {
      filteredStudents = allStudents.filter((s) => s.batchName === defaultBatch);
    } else if (filterCourse) {
      filteredStudents = allStudents.filter((s) => s.courseName === filterCourse);
    }

    const batchLeaderboard = filteredStudents
      .sort((a, b) => b.points - a.points || b.bestWpm - a.bestWpm)
      .slice(0, 100);

    return NextResponse.json({
      general,
      batch: batchLeaderboard,
      selectedBatch: defaultBatch,
      coursesMap,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({
      general: [],
      batch: [],
      selectedBatch: '',
      coursesMap: {},
      _error: (error instanceof Error ? error.message : 'Unknown error'),
    });
  }
}
