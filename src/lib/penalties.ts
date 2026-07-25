import { supabase } from './supabase';
import { toLocalDateString, localDateBoundsUTC, localDateDaysAgo, nextLocalDate } from './date';
import { fetchBatchTarget } from './batchTargets';

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
      const batchTarget = await fetchBatchTarget(user.batch_name);
      if (batchTarget) {
        targetMinutes = batchTarget.daily_target_minutes ?? 5;
        penaltyPoints = batchTarget.points_deduction ?? 10;
      }
    }

    const targetSeconds = targetMinutes * 60;
    const now = new Date();

    // Start from lastPenaltyCheck, check up to yesterday — in institute-local
    // calendar days, not UTC, so the boundary lines up with midnight where
    // the institute actually is rather than flipping mid-evening/morning.
    const lastCheck = user.last_penalty_check
      ? new Date(user.last_penalty_check)
      : new Date(user.created_at || now);

    const startDateStr = toLocalDateString(lastCheck);
    const yesterdayDateStr = localDateDaysAgo(1);

    if (startDateStr >= yesterdayDateStr) return;

    // Build every calendar date in the gap up front, then fetch everything
    // needed for the whole range in two queries — not one (or two) query per
    // day. A student inactive for months previously meant hundreds of
    // sequential awaited round trips on the request that happened to trigger
    // this (dashboard load, practice save, task submit), which could hang or
    // time out the request entirely with zero progress saved.
    const dateStrs: string[] = [];
    let cursor = startDateStr;
    while (cursor <= yesterdayDateStr) {
      dateStrs.push(cursor);
      cursor = nextLocalDate(cursor);
    }

    const rangeStart = localDateBoundsUTC(dateStrs[0]).startUTC.toISOString();
    const rangeEnd = localDateBoundsUTC(dateStrs[dateStrs.length - 1]).endUTC.toISOString();

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
      const dateStr = toLocalDateString(new Date(s.created_at));
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
