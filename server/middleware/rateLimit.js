// In-memory fixed-window per-IP rate limiter (single instance; fine for our scale).
function createRateLimiter({ max = 60, windowMs = 60000, now = Date.now } = {}) {
  const hits = new Map(); // ip -> { count, windowStart }
  return function rateLimit(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const t = now();
    let rec = hits.get(ip);
    if (!rec || t - rec.windowStart >= windowMs) {
      rec = { count: 0, windowStart: t };
      hits.set(ip, rec);
    }
    rec.count += 1;
    if (rec.count > max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

module.exports = { createRateLimiter };
