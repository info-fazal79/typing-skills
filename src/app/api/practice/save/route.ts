import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Apply retrospective penalties first
    await applyInactivityPenalties(user.id);

    const body = await req.json();
    const { wpm, accuracy, duration, language, mode } = body;

    if (wpm === undefined || accuracy === undefined || duration === undefined || !language || !mode) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Calculate points: WPM * (Accuracy/100) * (Duration/30), capped at 80
    const calculatedPoints = Math.round((wpm * (accuracy / 100)) * (duration / 30));
    const pointsEarned = Math.max(0, Math.min(80, calculatedPoints));

    const sessionId = crypto.randomUUID();
    const now = new Date();

    const sessionData = {
      userId: user.id,
      wpm: parseFloat(wpm),
      accuracy: parseFloat(accuracy),
      duration: parseInt(duration),
      language: language.toUpperCase(),
      mode,
      pointsEarned,
      createdAt: now,
    };

    // Atomic batch write: save session + increment user points
    const batch = db.batch();
    batch.set(db.collection('practice_sessions').doc(sessionId), sessionData);

    // Fetch existing user stats to compute bestWpm / avgWpm
    const currentUserSnap = await db.collection('users').doc(user.id).get();
    const currentUserData = currentUserSnap.data() ?? {};
    const currentBestWpm: number = currentUserData.bestWpm ?? 0;
    const currentTotalWpm: number = currentUserData.totalWpmSum ?? 0;
    const currentSessionCount: number = currentUserData.sessionCount ?? 0;

    const newBestWpm = Math.max(currentBestWpm, parseFloat(wpm));
    const newTotalWpm = currentTotalWpm + parseFloat(wpm);
    const newSessionCount = currentSessionCount + 1;
    const newAvgWpm = Math.round(newTotalWpm / newSessionCount);

    batch.update(db.collection('users').doc(user.id), {
      points: FieldValue.increment(pointsEarned),
      bestWpm: newBestWpm,
      avgWpm: newAvgWpm,
      totalWpmSum: newTotalWpm,
      sessionCount: newSessionCount,
      updatedAt: now,
    });
    await batch.commit();

    // Fetch updated points
    const updatedUser = await db.collection('users').doc(user.id).get();
    const newPointsTotal = updatedUser.data()?.points ?? user.points + pointsEarned;

    return NextResponse.json({
      message: 'Practice session saved successfully',
      pointsEarned,
      newPointsTotal,
      session: { id: sessionId, ...sessionData },
    });
  } catch (error: any) {
    console.error('Save practice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
