import { supabase } from './supabase';

/**
 * Checks and applies daily inactivity penalties for a student retrospectively.
 * Runs on user actions (login, dashboard load, saving practice session).
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
    startCheckDate.setHours(0, 0, 0, 0);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    if (startCheckDate >= yesterday) return;

    let currentDate = new Date(startCheckDate);
    let totalDeductions = 0;
    const logsToCreate: { id: string; user_id: string; date: string; points_deducted: number; created_at: string }[] = [];

    while (currentDate <= yesterday) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const logId = `${userId}_${dateStr}`;

      // We'll skip existing log check to speed up if possible, 
      // but let's query it if needed, or rely on Upsert constraints.
      // Since inactivity_logs wasn't in original schema script, 
      // we'll just check it gracefully.
      const { data: existingLog } = await supabase
        .from('inactivity_logs')
        .select('id')
        .eq('id', logId)
        .single();

      if (!existingLog) {
        const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
        const dayEnd = new Date(`${dateStr}T23:59:59.999`).toISOString();

        const { data: sessionsSnap } = await supabase
          .from('practice_sessions')
          .select('duration')
          .eq('user_id', userId)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const totalPracticeSeconds = (sessionsSnap || []).reduce(
          (sum, d) => sum + (d.duration ?? 0),
          0
        );

        const pointsDeducted = totalPracticeSeconds < targetSeconds ? penaltyPoints : 0;
        if (pointsDeducted > 0) totalDeductions += pointsDeducted;

        logsToCreate.push({
          id: logId,
          user_id: userId,
          date: dateStr,
          points_deducted: pointsDeducted,
          created_at: now.toISOString(),
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Apply updates
    if (logsToCreate.length > 0) {
      try { await supabase.from('inactivity_logs').upsert(logsToCreate); } catch (_) {} // ignore if table doesn't exist
    }

    const newPoints = Math.max(0, (user.points ?? 0) - totalDeductions);
    await supabase.from('users').update({
      points: newPoints,
      last_penalty_check: now.toISOString(),
    }).eq('id', userId);

    if (totalDeductions > 0) {
      console.log(`Applied inactivity penalty for user ${user.email}. Deducted: ${totalDeductions} points.`);
    }
  } catch (error) {
    console.error('Error applying inactivity penalties:', error);
  }
}
