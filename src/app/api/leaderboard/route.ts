import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterBatch = searchParams.get('batch');

    // Fetch overall leaderboard
    const overallLeaderboard = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        status: 'APPROVED',
      },
      select: {
        id: true,
        name: true,
        courseName: true,
        batchName: true,
        rollNumber: true,
        points: true,
      },
      orderBy: { points: 'desc' },
      take: 50,
    });

    // Fetch batch list for the filter dropdown
    const batches = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        status: 'APPROVED',
        batchName: { not: null },
      },
      select: { batchName: true },
      distinct: ['batchName'],
    });
    const batchList = batches.map(b => b.batchName).filter(Boolean) as string[];

    // Fetch batch-wise leaderboard
    let batchLeaderboard: any[] = [];
    let selectedBatch = filterBatch || user.batchName || '';

    if (selectedBatch) {
      batchLeaderboard = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          status: 'APPROVED',
          batchName: selectedBatch,
        },
        select: {
          id: true,
          name: true,
          courseName: true,
          batchName: true,
          rollNumber: true,
          points: true,
        },
        orderBy: { points: 'desc' },
        take: 50,
      });
    }

    return NextResponse.json({
      overall: overallLeaderboard,
      batch: batchLeaderboard,
      selectedBatch,
      batches: batchList,
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
