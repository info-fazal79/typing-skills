import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Account pending admin approval. Stats will not be saved.' },
        { status: 403 }
      );
    }

    // Apply retrospective penalties first to ensure points sync
    await applyInactivityPenalties(user.id);

    const body = await req.json();
    const { wpm, accuracy, duration, language, mode } = body;

    if (wpm === undefined || accuracy === undefined || duration === undefined || !language || !mode) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Calculate points
    // Formula: WPM * (Accuracy / 100) * (Duration / 30)
    // Example: WPM 60, Accuracy 100%, 30s duration = 60 points
    const calculatedPoints = Math.round((wpm * (accuracy / 100)) * (duration / 30));
    
    // Capped points per session to prevent abuse (e.g. max 80 points)
    const pointsEarned = Math.max(0, Math.min(80, calculatedPoints));

    // Save session & update user points
    const [savedSession, updatedUser] = await prisma.$transaction([
      prisma.practiceSession.create({
        data: {
          userId: user.id,
          wpm: parseFloat(wpm),
          accuracy: parseFloat(accuracy),
          duration: parseInt(duration),
          language: language.toUpperCase(),
          mode,
          pointsEarned,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          points: {
            increment: pointsEarned,
          },
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Practice session saved successfully',
      pointsEarned,
      newPointsTotal: updatedUser.points,
      session: savedSession,
    });
  } catch (error: any) {
    console.error('Save practice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
