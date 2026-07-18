import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch all batch targets
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snap = await db.collection('batch_targets').orderBy('batchName', 'asc').get();

    const targets = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ targets });
  } catch (error: any) {
    console.error('Fetch targets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Upsert target configuration for a batch
export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { batchName, dailyTargetMinutes, pointsDeduction } = body;

    if (!batchName || dailyTargetMinutes === undefined || pointsDeduction === undefined) {
      return NextResponse.json(
        { error: 'Missing batchName, dailyTargetMinutes, or pointsDeduction' },
        { status: 400 }
      );
    }

    const trimmedBatch = batchName.trim();
    const now = new Date();

    // Firestore set with merge = upsert
    await db.collection('batch_targets').doc(trimmedBatch).set(
      {
        batchName: trimmedBatch,
        dailyTargetMinutes: parseInt(dailyTargetMinutes),
        pointsDeduction: parseInt(pointsDeduction),
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      message: 'Batch target configuration updated successfully',
      target: { batchName: trimmedBatch, dailyTargetMinutes, pointsDeduction },
    });
  } catch (error: any) {
    console.error('Upsert target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
