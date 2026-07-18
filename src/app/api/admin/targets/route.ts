import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch all batch targets
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targets = await prisma.batchTarget.findMany({
      orderBy: { batchName: 'asc' },
    });

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
      return NextResponse.json({ error: 'Missing batchName, dailyTargetMinutes, or pointsDeduction' }, { status: 400 });
    }

    const target = await prisma.batchTarget.upsert({
      where: { batchName: batchName.trim() },
      update: {
        dailyTargetMinutes: parseInt(dailyTargetMinutes),
        pointsDeduction: parseInt(pointsDeduction),
      },
      create: {
        batchName: batchName.trim(),
        dailyTargetMinutes: parseInt(dailyTargetMinutes),
        pointsDeduction: parseInt(pointsDeduction),
      },
    });

    return NextResponse.json({
      message: 'Batch target configuration updated successfully',
      target,
    });
  } catch (error: any) {
    console.error('Upsert target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
