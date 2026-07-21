import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch user (only public fields)
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, name, role, status, course_name, batch_name, roll_number, points, best_wpm, avg_wpm, session_count, created_at')
      .eq('id', id)
      .eq('status', 'APPROVED')
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch all practice sessions for this user
    const { data: sessions } = await supabase
      .from('practice_sessions')
      .select('id, wpm, accuracy, duration, language, mode, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    const allSessions = sessions || [];

    // Derived analytics
    const totalTests = allSessions.length;
    const bestWpm = totalTests > 0 ? Math.max(...allSessions.map(s => s.wpm ?? 0)) : 0;
    const avgWpm = totalTests > 0
      ? Math.round(allSessions.reduce((sum, s) => sum + (s.wpm ?? 0), 0) / totalTests)
      : 0;
    const avgAccuracy = totalTests > 0
      ? Math.round(allSessions.reduce((sum, s) => sum + (s.accuracy ?? 0), 0) / totalTests)
      : 0;
    const totalSeconds = allSessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    const recentSessions = allSessions.slice(0, 20).map(s => ({
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
        courseName: user.course_name ?? null,
        batchName: user.batch_name ?? null,
        rollNumber: user.roll_number ?? null,
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
