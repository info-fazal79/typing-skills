import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
    const now = new Date().toISOString();

    // Insert the new practice session
    const { error: sessionErr } = await supabase.from('practice_sessions').insert({
      id: sessionId,
      user_id: user.id,
      wpm: parseFloat(wpm),
      accuracy: parseFloat(accuracy),
      duration: parseInt(duration),
      language: language.toUpperCase(),
      mode,
      points_earned: pointsEarned,
      created_at: now,
    });
    if (sessionErr) throw sessionErr;

    // Fetch existing user stats to compute bestWpm / avgWpm
    const { data: currentUser } = await supabase
      .from('users')
      .select('best_wpm, total_wpm_sum, session_count, points')
      .eq('id', user.id)
      .single();

    const currentBestWpm: number = currentUser?.best_wpm ?? 0;
    const currentTotalWpm: number = currentUser?.total_wpm_sum ?? 0;
    const currentSessionCount: number = currentUser?.session_count ?? 0;

    const newBestWpm = Math.max(currentBestWpm, parseFloat(wpm));
    const newTotalWpm = currentTotalWpm + parseFloat(wpm);
    const newSessionCount = currentSessionCount + 1;
    const newAvgWpm = Math.round(newTotalWpm / newSessionCount);
    const newPoints = (currentUser?.points ?? 0) + pointsEarned;

    // Update user stats
    await supabase.from('users').update({
      points: newPoints,
      best_wpm: newBestWpm,
      avg_wpm: newAvgWpm,
      total_wpm_sum: newTotalWpm,
      session_count: newSessionCount,
      updated_at: now,
    }).eq('id', user.id);

    return NextResponse.json({
      message: 'Practice session saved successfully',
      pointsEarned,
      newPointsTotal: newPoints,
      session: { id: sessionId },
    });
  } catch (error) {
    console.error('Save practice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
