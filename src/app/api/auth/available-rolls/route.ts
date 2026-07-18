import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get('batchName');

    if (!batchName) {
      return NextResponse.json({ error: 'batchName is required' }, { status: 400 });
    }

    // 1. Fetch metadata to get all allowed rolls for this batch
    const docRef = db.collection('metadata').doc('selectors');
    const doc = await docRef.get();
    
    let allRolls: string[] = [];
    if (doc.exists) {
      const data = doc.data() as any;
      if (data.rollNumbersByBatch && data.rollNumbersByBatch[batchName]) {
        allRolls = data.rollNumbersByBatch[batchName];
      }
    }

    // 2. Query users collection to find claimed rolls for this batch
    const usersSnap = await db
      .collection('users')
      .where('role', '==', 'STUDENT')
      .where('batchName', '==', batchName)
      .get();
      
    const claimedRolls = new Set<string>();
    usersSnap.docs.forEach(uDoc => {
      const uData = uDoc.data();
      if (uData.rollNumber) {
        claimedRolls.add(uData.rollNumber);
      }
    });

    // 3. Filter out claimed rolls
    const availableRolls = allRolls.filter(roll => !claimedRolls.has(roll));

    return NextResponse.json({ availableRolls });
  } catch (error: any) {
    console.error('Failed to fetch available rolls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
