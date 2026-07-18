import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch metadata selectors (Courses, Batches, Roll Numbers)
export async function GET() {
  try {
    const docRef = db.collection('metadata').doc('selectors');
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ courses: {}, rollNumbersByBatch: {} });
    }
    
    return NextResponse.json(doc.data());
  } catch (error: any) {
    console.error('Failed to fetch metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update metadata selectors (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    // Validate basic structure
    if (typeof data !== 'object' || !data.courses || !data.rollNumbersByBatch) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const docRef = db.collection('metadata').doc('selectors');
    await docRef.set(data, { merge: true });

    return NextResponse.json({ message: 'Metadata updated successfully', data });
  } catch (error: any) {
    console.error('Failed to update metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
