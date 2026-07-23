import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { applyInactivityPenalties } from '@/lib/penalties';
import { isValidSessionStats } from '@/lib/validation';
import { calculatePoints } from '@/lib/points';

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

    if (!isValidSessionStats(wpm, accuracy, duration)) {
      return NextResponse.json({ error: 'Invalid session stats' }, { status: 400 });
    }

    const pointsEarned = calculatePoints(
      language,
      mode,
      parseFloat(wpm),
      parseFloat(accuracy),
      parseInt(duration)
    );

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

    // Atomic increment — a single UPDATE statement in Postgres, not a
    // select-then-write in application code, so two concurrent saves for the
    // same user can't clobber each other's points/stats.
    const { data: statsRows, error: statsErr } = await supabase.rpc(
      'record_practice_session_stats',
      { p_user_id: user.id, p_points_delta: pointsEarned, p_wpm: parseFloat(wpm) }
    );
    if (statsErr) throw statsErr;
    const newPoints = statsRows?.[0]?.points ?? pointsEarned;

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
