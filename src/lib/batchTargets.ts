import { supabase } from './supabase';

export interface BatchTargetRow {
  batch_name: string;
  typing_type: string | null;
  daily_target_minutes: number | null;
  points_deduction: number | null;
}

/**
 * A batch can have more than one target row (one per typing_type — English,
 * Bangla, ...), since admin/targets upserts on (batch_name, typing_type).
 * Picking a row was previously done ad hoc in two places (dashboard route
 * via an unordered `[0]`, penalties.ts via `.single()`, which errors out —
 * and is silently swallowed — the moment a batch has more than one row).
 * Neither actually picked a specific, correct target when a batch has
 * multiple; this makes the choice explicit and deterministic: prefer the
 * "English" row (the historical default when no batch_targets exist at
 * all), otherwise fall back to whichever row sorts first.
 */
export function pickBatchTarget(rows: BatchTargetRow[]): BatchTargetRow | null {
  if (rows.length === 0) return null;
  const english = rows.find((r) => (r.typing_type || 'English').trim().toLowerCase() === 'english');
  if (english) return english;
  return [...rows].sort((a, b) => (a.typing_type || '').localeCompare(b.typing_type || ''))[0];
}

export async function fetchBatchTarget(batchName: string): Promise<BatchTargetRow | null> {
  const { data, error } = await supabase
    .from('batch_targets')
    .select('*')
    .eq('batch_name', batchName);

  if (error || !data) return null;
  return pickBatchTarget(data);
}
