// The app's "today" (daily target progress, inactivity penalties) needs to
// mean the institute's local calendar day, not the server's UTC day — a
// student practicing late at night was otherwise seeing the day boundary
// flip at 6am local time instead of midnight, since Vercel runs UTC and the
// institute operates on Bangladesh time (UTC+6, no DST).
const INSTITUTE_OFFSET_MINUTES = 6 * 60;

/**
 * The institute-local calendar date (YYYY-MM-DD) that a given instant falls
 * on.
 */
export function toLocalDateString(date: Date): string {
  const shifted = new Date(date.getTime() + INSTITUTE_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().split('T')[0];
}

/**
 * The UTC instants bounding a given institute-local calendar date, for use
 * in Supabase range queries against UTC timestamp columns.
 */
export function localDateBoundsUTC(localDateStr: string): { startUTC: Date; endUTC: Date } {
  const startAsIfUTC = new Date(`${localDateStr}T00:00:00.000Z`);
  const startUTC = new Date(startAsIfUTC.getTime() - INSTITUTE_OFFSET_MINUTES * 60 * 1000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUTC, endUTC };
}

/**
 * The institute-local calendar date `daysAgo` days before local "now".
 */
export function localDateDaysAgo(daysAgo: number): string {
  const shifted = new Date(Date.now() + INSTITUTE_OFFSET_MINUTES * 60 * 1000);
  shifted.setUTCDate(shifted.getUTCDate() - daysAgo);
  return shifted.toISOString().split('T')[0];
}

/**
 * The next institute-local calendar date after `localDateStr`.
 */
export function nextLocalDate(localDateStr: string): string {
  const d = new Date(`${localDateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Short weekday label (e.g. "Mon") for a YYYY-MM-DD local date string. */
export function localDateWeekday(localDateStr: string): string {
  return new Date(`${localDateStr}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  });
}
