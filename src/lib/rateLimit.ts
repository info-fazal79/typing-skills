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
  // Trust the LAST hop in X-Forwarded-For, not the first. The first entry
  // is whatever the client itself sent — fully spoofable, since a request
  // can arrive with an attacker-chosen X-Forwarded-For already set, which
  // the reverse proxy in front of this app appends to rather than replaces.
  // The last entry is what that proxy actually saw connecting to it, which
  // a client can't forge. This assumes exactly one trusted reverse proxy
  // sits directly in front of this Node process (cPanel/Passenger's
  // standard setup) — if a CDN or extra proxy layer is ever added in front
  // of that, this needs to skip further from the end accordingly.
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

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
