import { httpError } from './asyncHandler.js';

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function loginAttemptKey(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const login = String(req.body?.login || '').trim().toLowerCase();
  return `${ip}|${login}`;
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  keyFn = loginAttemptKey,
  message = 'Muitas tentativas. Espere um pouco e tente de novo.',
  now = Date.now,
} = {}) {
  const hits = new Map();

  function middleware(req, res, next) {
    const current = now();
    const key = keyFn(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= current) {
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - current) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      next(httpError(429, message));
      return;
    }

    next();
  }

  middleware.reset = () => hits.clear();
  return middleware;
}

export function envWindowMs(fallback = 15 * 60 * 1000) {
  return positiveInt(process.env.LOGIN_RATE_WINDOW_MS, fallback);
}

export function envMaxAttempts(fallback = 10) {
  return positiveInt(process.env.LOGIN_RATE_MAX, fallback);
}
