/**
 * Lightweight in-memory rate limiter for a single Node process.
 * For multi-instance deployments, replace with a shared Redis-backed limiter.
 */
const buckets = new Map();

const rateLimiter = ({
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max = Number(process.env.RATE_LIMIT_MAX) || 30,
  keyGenerator = (req) => req.user?.id || req.ip || "unknown",
  message = "Too many requests. Please try again later.",
} = {}) => (req, res, next) => {
  const now = Date.now();
  const key = `${req.baseUrl}:${req.route?.path || req.path}:${keyGenerator(req)}`;
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > max) {
    return res.status(429).json({ success: false, message });
  }

  next();
};

// Prevent the map growing forever on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();

module.exports = rateLimiter;
