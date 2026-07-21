import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Try to find by slug first, then fall back to id (for backwards compatibility)
    let user = null;

    // First try by slug
    const { data: bySlug } = await supabase
      .from('users')
      .select('id, name, role, status, course_name, batch_name, roll_number, points, best_wpm, avg_wpm, session_count, created_at, slug')
      .eq('slug', slug)
      .eq('status', 'APPROVED')
      .single();

    if (bySlug) {
      user = bySlug;
    } else {
      // Fall back to searching by id (for old links)
      const { data: byId } = await supabase
        .from('users')
        .select('id, name, role, status, course_name, batch_name, roll_number, points, best_wpm, avg_wpm, session_count, created_at, slug')
        .eq('id', slug)
        .eq('status', 'APPROVED')
        .single();
      if (byId) {
        user = byId;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // This endpoint is public (linked from the public leaderboard, no login
    // required) — roll number ties a real name to an institutional student ID,
    // so only show it to the profile owner or an admin, not to any visitor.
    const viewer = await getUserFromRequest(req);
    const canSeeRollNumber = !!viewer && (viewer.id === user.id || viewer.role === 'ADMIN');

    // bestWpm/avgWpm/totalTests are already maintained incrementally on the
    // user row itself (see practice/save's update on every session) — no
    // need to re-derive them from a full session-history scan.
    const totalTests = user.session_count ?? 0;
    const bestWpm = user.best_wpm ?? 0;
    const avgWpm = user.avg_wpm ?? 0;

    // avgAccuracy/totalMinutes aren't denormalized anywhere, so they still
    // need a pass over all sessions — but only 2 narrow numeric columns,
    // not the full row, and separately from the bounded recent-sessions list.
    let avgAccuracy = 0;
    let totalMinutes = 0;
    const { data: aggregateRows } = await supabase
      .from('practice_sessions')
      .select('accuracy, duration')
      .eq('user_id', user.id);

    if (aggregateRows && aggregateRows.length > 0) {
      let accuracySum = 0;
      let durationSum = 0;
      for (const r of aggregateRows) {
        accuracySum += r.accuracy ?? 0;
        durationSum += r.duration ?? 0;
      }
      avgAccuracy = Math.round(accuracySum / aggregateRows.length);
      totalMinutes = Math.round(durationSum / 60);
    }

    const { data: recentRows } = await supabase
      .from('practice_sessions')
      .select('id, wpm, accuracy, duration, language, mode, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const recentSessions = (recentRows || []).map(s => ({
      id: s.id,
      wpm: s.wpm ?? 0,
      accuracy: s.accuracy ?? 0,
      duration: s.duration ?? 0,
      language: s.language ?? 'ENGLISH',
      mode: s.mode ?? 'Standard',
      createdAt: s.created_at,
    }));

    return NextResponse.json({
      profile: {
        id: user.id,
        name: user.name,
        role: user.role,
        slug: user.slug ?? null,
        courseName: user.course_name ?? null,
        batchName: user.batch_name ?? null,
        rollNumber: canSeeRollNumber ? (user.roll_number ?? null) : null,
        points: user.points ?? 0,
        joinedAt: user.created_at,
      },
      analytics: {
        totalTests,
        bestWpm,
        avgWpm,
        avgAccuracy,
        totalMinutes,
      },
      recentSessions,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
