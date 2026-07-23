import { supabase } from './supabase';

/**
 * Checks and applies daily inactivity penalties for a student retrospectively.
 * Runs on user actions (dashboard load, saving a practice session, task submit).
 */
export async function applyInactivityPenalties(userId: string) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) return;
    if (user.role !== 'STUDENT' || user.status !== 'APPROVED') return;

    // Get batch target configuration
    let targetMinutes = 5;
    let penaltyPoints = 10;

    if (user.batch_name) {
      const { data: batchTarget } = await supabase
        .from('batch_targets')
        .select('*')
        .eq('batch_name', user.batch_name)
        .single();

      if (batchTarget) {
        targetMinutes = batchTarget.daily_target_minutes ?? 5;
        penaltyPoints = batchTarget.points_deduction ?? 10;
      }
    }

    const targetSeconds = targetMinutes * 60;
    const now = new Date();

    // Start from lastPenaltyCheck, check up to yesterday
    const lastCheck = user.last_penalty_check
      ? new Date(user.last_penalty_check)
      : new Date(user.created_at || now);

    const startCheckDate = new Date(lastCheck);
    startCheckDate.setUTCHours(0, 0, 0, 0);

    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(23, 59, 59, 999);

    if (startCheckDate >= yesterday) return;

    // Build every calendar date in the gap up front, then fetch everything
    // needed for the whole range in two queries — not one (or two) query per
    // day. A student inactive for months previously meant hundreds of
    // sequential awaited round trips on the request that happened to trigger
    // this (dashboard load, practice save, task submit), which could hang or
    // time out the request entirely with zero progress saved.
    const dateStrs: string[] = [];
    const cursor = new Date(startCheckDate);
    while (cursor <= yesterday) {
      dateStrs.push(cursor.toISOString().split('T')[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const rangeStart = `${dateStrs[0]}T00:00:00.000Z`;
    const rangeEnd = `${dateStrs[dateStrs.length - 1]}T23:59:59.999Z`;

    // Which of these dates were already checked in a previous call? The
    // inactivity_logs table may not exist in every deployment yet — degrade
    // gracefully (treat as "nothing logged yet") instead of letting this
    // throw and abort the whole function, which would also skip advancing
    // last_penalty_check below and cause every future call to re-scan the
    // same growing range forever.
    let existingDates = new Set<string>();
    try {
      const { data: existingLogs } = await supabase
        .from('inactivity_logs')
        .select('date')
        .eq('user_id', userId)
        .gte('date', dateStrs[0])
        .lte('date', dateStrs[dateStrs.length - 1]);
      existingDates = new Set((existingLogs || []).map((l) => l.date));
    } catch (e) {
      console.warn('inactivity_logs lookup failed (table may not exist yet):', e);
    }

    // Total practice seconds per day across the whole range, in one query.
    const { data: sessionsSnap } = await supabase
      .from('practice_sessions')
      .select('created_at, duration')
      .eq('user_id', userId)
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd);

    const secondsByDate = new Map<string, number>();
    for (const s of sessionsSnap || []) {
      const dateStr = new Date(s.created_at).toISOString().split('T')[0];
      secondsByDate.set(dateStr, (secondsByDate.get(dateStr) ?? 0) + (s.duration ?? 0));
    }

    const logsToCreate: { id: string; user_id: string; date: string; points_deducted: number; created_at: string }[] = [];
    let totalDeductions = 0;

    for (const dateStr of dateStrs) {
      if (existingDates.has(dateStr)) continue;

      const totalPracticeSeconds = secondsByDate.get(dateStr) ?? 0;
      const pointsDeducted = totalPracticeSeconds < targetSeconds ? penaltyPoints : 0;
      if (pointsDeducted > 0) totalDeductions += pointsDeducted;

      logsToCreate.push({
        id: `${userId}_${dateStr}`,
        user_id: userId,
        date: dateStr,
        points_deducted: pointsDeducted,
        created_at: now.toISOString(),
      });
    }

    if (logsToCreate.length > 0) {
      try {
        await supabase.from('inactivity_logs').upsert(logsToCreate);
      } catch (e) {
        console.warn('Failed to upsert inactivity_logs (table may not exist yet):', e);
      }
    }

    // Atomic: deduct + advance the checkpoint in a single statement, so a
    // concurrent request for the same user (or another penalty/points update
    // landing at the same moment) can't clobber this one.
    const { error: deductErr } = await supabase.rpc('apply_penalty_deduction', {
      p_user_id: userId,
      p_deduction: totalDeductions,
      p_checked_at: now.toISOString(),
    });
    if (deductErr) throw deductErr;

    if (totalDeductions > 0) {
      console.log(`Applied inactivity penalty for user ${user.email}. Deducted: ${totalDeductions} points.`);
    }
  } catch (error) {
    console.error('Error applying inactivity penalties:', error);
  }
}
