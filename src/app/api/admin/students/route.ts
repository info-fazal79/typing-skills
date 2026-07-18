import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch student directory with optional filters
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const course = searchParams.get('course') || undefined;
    const batch = searchParams.get('batch') || undefined;
    const roll = searchParams.get('roll') || undefined;

    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        status: status,
        courseName: course ? { contains: course } : undefined,
        batchName: batch ? { contains: batch } : undefined,
        rollNumber: roll ? { contains: roll } : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        courseName: true,
        batchName: true,
        rollNumber: true,
        status: true,
        points: true,
        createdAt: true,
      },
      orderBy: [
        { status: 'asc' }, // Pending first
        { createdAt: 'desc' },
      ],
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

    const updatedStudent = await prisma.user.update({
      where: { id: studentId },
      data: {
        status,
        // Reset penalty check date to today if approved, so they start fresh
        lastPenaltyCheck: status === 'APPROVED' ? new Date() : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    return NextResponse.json({
      message: `Student status successfully updated to ${status}`,
      student: updatedStudent,
    });
  } catch (error: any) {
    console.error('Update student status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
