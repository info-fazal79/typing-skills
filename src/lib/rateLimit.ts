import { NextRequest } from 'next/server';

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory fixed-window limiter. Correct for this app's deployment (a single
// long-lived Node process behind Nginx/Passenger, not a serverless/multi-instance
// setup) — state living in-process is fine because there's only one process.
const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

/**
 * Returns true if the request should be allowed, false if it has exceeded
 * `limit` attempts within `windowMs` for the given key/client combination.
 */
export function checkRateLimit(
  req: NextRequest,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const bucketKey = `${key}:${getClientIp(req)}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

// Periodically drop expired buckets so this map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();
