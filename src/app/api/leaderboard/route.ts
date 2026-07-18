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

    // General leaderboard: top 50 users (role: USER, status: APPROVED)
    const generalSnap = await db
      .collection('users')
      .where('role', '==', 'USER')
      .where('status', '==', 'APPROVED')
      .orderBy('points', 'desc')
      .limit(50)
      .get();

    const general = generalSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        points: d.points ?? 0,
      };
    });

    // Student Leaderboard Setup (Batches)
    // First we need all batches to populate the dropdown
    // Since we don't want to query all students to find unique batches, we can fetch from metadata
    let batchList: string[] = [];
    try {
      const metadataSnap = await db.collection('metadata').doc('selectors').get();
      if (metadataSnap.exists) {
        const metadataData = metadataSnap.data() as { courses: Record<string, string[]> };
        if (metadataData && metadataData.courses) {
          const allBatches = new Set<string>();
          Object.values(metadataData.courses).forEach((batches) => {
            batches.forEach(b => allBatches.add(b));
          });
          batchList = Array.from(allBatches).sort();
        }
      }
    } catch (e) {
      console.warn("Failed to fetch metadata for batches", e);
    }

    // Batch leaderboard (role: STUDENT, status: APPROVED, filtered by batchName)
    const selectedBatch = filterBatch || user.batchName || (batchList.length > 0 ? batchList[0] : '');
    let batchLeaderboard: any[] = [];

    if (selectedBatch) {
      const batchSnap = await db
        .collection('users')
        .where('role', '==', 'STUDENT')
        .where('status', '==', 'APPROVED')
        .where('batchName', '==', selectedBatch)
        .orderBy('points', 'desc')
        .limit(50)
        .get();

      batchLeaderboard = batchSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          courseName: d.courseName,
          batchName: d.batchName,
          rollNumber: d.rollNumber,
          points: d.points ?? 0,
        };
      });
    }

    return NextResponse.json({
      general,
      batch: batchLeaderboard,
      selectedBatch,
      batches: batchList,
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
