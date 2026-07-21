// Sanity bounds for client-reported typing stats. These are business-logic
// limits (nobody legitimately types 1000 WPM), not authentication — they only
// stop obviously-forged leaderboard/points submissions, not a determined
// attacker replaying a crafted-but-plausible payload.
const MAX_WPM = 400;
const MAX_DURATION_SECONDS = 3600;

export function isValidSessionStats(wpm: unknown, accuracy: unknown, duration?: unknown): boolean {
  const w = Number(wpm);
  const a = Number(accuracy);

  if (!Number.isFinite(w) || w < 0 || w > MAX_WPM) return false;
  if (!Number.isFinite(a) || a < 0 || a > 100) return false;

  if (duration !== undefined) {
    const d = Number(duration);
    if (!Number.isFinite(d) || d <= 0 || d > MAX_DURATION_SECONDS) return false;
  }

  return true;
}
