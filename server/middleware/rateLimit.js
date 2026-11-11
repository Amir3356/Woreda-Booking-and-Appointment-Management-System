// Per-IP rate limiting (token bucket, in memory). Excess requests get 429 TOO_MANY_REQUESTS.
// The API allows 5 requests/second with bursts of 50; sign-in and registration 20/minute with bursts of 10.
import { fail } from "../utils/response.js";

/** ratePerSecond: refill rate; burst: bucket size. */
export function rateLimit({ ratePerSecond, burst }) {
  const buckets = new Map(); // ip -> { tokens, at }
  // Forget idle clients so the map does not grow without bound.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [ip, b] of buckets) if (b.at < cutoff) buckets.delete(ip);
  }, 60 * 1000);
  sweep.unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "";
    const now = Date.now();
    const b = buckets.get(ip) ?? { tokens: burst, at: now };
    b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * ratePerSecond);
    b.at = now;
    buckets.set(ip, b);
    if (b.tokens < 1) {
      res.setHeader("Retry-After", String(Math.ceil((1 - b.tokens) / ratePerSecond)));
      return fail(res, req, 429, "TOO_MANY_REQUESTS", "Too many requests. Please slow down and try again shortly.");
    }
    b.tokens -= 1;
    next();
  };
}
