import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
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
      const metaSnap = await db.collection('metadata').doc('selectors').get();
      if (metaSnap.exists) {
        const d = metaSnap.data() as any;
        if (d?.courses) coursesMap = d.courses;
      }
    } catch (e) {
      console.warn('Failed to fetch metadata', e);
    }

    // ── 2. General Leaderboard ─────────────────────────────────────────────
    // Fetch ALL approved users with role USER, sort in-memory (avoids composite index)
    const generalSnap = await db
      .collection('users')
      .where('status', '==', 'APPROVED')
      .where('role', '==', 'USER')
      .get();

    const general = generalSnap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          points: d.points ?? 0,
          bestWpm: d.bestWpm ?? 0,
          avgWpm: d.avgWpm ?? 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.bestWpm - a.bestWpm)
      .slice(0, 100);

    // ── 3. Batch Leaderboard ───────────────────────────────────────────────
    // Fetch ALL approved students, filter + sort in-memory (avoids composite index)
    const allStudentsSnap = await db
      .collection('users')
      .where('status', '==', 'APPROVED')
      .where('role', '==', 'STUDENT')
      .get();

    const allStudents = allStudentsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        courseName: d.courseName ?? '',
        batchName: d.batchName ?? '',
        rollNumber: d.rollNumber ?? '',
        points: d.points ?? 0,
        bestWpm: d.bestWpm ?? 0,
        avgWpm: d.avgWpm ?? 0,
      };
    });

    // Determine which batch to show
    const defaultBatch =
      filterBatch ||
      (user.role === 'STUDENT' ? (user as any).batchName : '') ||
      '';

    // Filter by batch (and optional course)
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
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    // Return safe empty structure instead of crashing
    return NextResponse.json({
      general: [],
      batch: [],
      selectedBatch: '',
      coursesMap: {},
      _error: error?.message ?? 'Unknown error',
    });
  }
}
