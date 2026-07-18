import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch student directory with optional filters
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const course = searchParams.get('course');
    const batch = searchParams.get('batch');
    const roll = searchParams.get('roll');

    let query: FirebaseFirestore.Query = db
      .collection('users')
      .where('role', '==', 'STUDENT');

    if (status) query = query.where('status', '==', status);
    if (batch) query = query.where('batchName', '==', batch);

    const snap = await query.get();

    let students = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        email: d.email,
        courseName: d.courseName,
        batchName: d.batchName,
        rollNumber: d.rollNumber,
        status: d.status,
        points: d.points ?? 0,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt),
      };
    });

    // Client-side filtering for contains-style filters (Firestore doesn't support LIKE)
    if (course) {
      students = students.filter((s) =>
        s.courseName?.toLowerCase().includes(course.toLowerCase())
      );
    }
    if (roll) {
      students = students.filter((s) =>
        s.rollNumber?.toLowerCase().includes(roll.toLowerCase())
      );
    }

    // Sort: PENDING first, then by createdAt desc
    students.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('Fetch students error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update student status (Approve, Reject, Suspend, Unsuspend)
export async function PUT(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, status } = body;

    if (!studentId || !status) {
      return NextResponse.json({ error: 'Missing studentId or status' }, { status: 400 });
    }

    if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'APPROVED') {
      updateData.lastPenaltyCheck = new Date();
    }

    await db.collection('users').doc(studentId).update(updateData);

    const updatedDoc = await db.collection('users').doc(studentId).get();
    const d = updatedDoc.data()!;

    return NextResponse.json({
      message: `Student status successfully updated to ${status}`,
      student: { id: studentId, name: d.name, email: d.email, status: d.status },
    });
  } catch (error: any) {
    console.error('Update student status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
