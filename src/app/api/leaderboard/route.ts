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

    // Overall leaderboard: top 50 approved students by points
    const overallSnap = await db
      .collection('users')
      .where('role', '==', 'STUDENT')
      .where('status', '==', 'APPROVED')
      .orderBy('points', 'desc')
      .limit(50)
      .get();

    const overall = overallSnap.docs.map((doc) => {
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

    // Collect unique batch names from overall results
    const batchSet = new Set<string>();
    overall.forEach((s) => { if (s.batchName) batchSet.add(s.batchName); });
    const batchList = Array.from(batchSet).sort();

    // Batch leaderboard
    const selectedBatch = filterBatch || user.batchName || '';
    let batchLeaderboard: typeof overall = [];

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
      overall,
      batch: batchLeaderboard,
      selectedBatch,
      batches: batchList,
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
