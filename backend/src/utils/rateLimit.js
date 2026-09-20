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

export function createMemoryRateStore() {
  const hits = new Map();
  return {
    async hit(key, windowMs, current) {
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= current) {
        entry = { count: 0, resetAt: current + windowMs };
      }
      entry.count += 1;
      hits.set(key, entry);
      return { count: entry.count, resetAt: entry.resetAt };
    },
    reset() {
      hits.clear();
    },
  };
}

export function createMongoRateStore(model) {
  return {
    async hit(key, windowMs, current) {
      const nowDate = new Date(current);
      const nextReset = new Date(current + windowMs);
      try {
        const doc = await model.findOneAndUpdate(
          { _id: key },
          [
            {
              $set: {
                count: {
                  $cond: [
                    { $gt: ['$resetAt', nowDate] },
                    { $add: [{ $ifNull: ['$count', 0] }, 1] },
                    1,
                  ],
                },
                resetAt: {
                  $cond: [{ $gt: ['$resetAt', nowDate] }, '$resetAt', nextReset],
                },
              },
            },
          ],
          { upsert: true, new: true },
        );
        return { count: doc.count, resetAt: doc.resetAt.getTime() };
      } catch (err) {
        if (err?.code === 11000) return this.hit(key, windowMs, current);
        throw err;
      }
    },
    async reset() {
      await model.deleteMany({});
    },
  };
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  keyFn = loginAttemptKey,
  message = 'Muitas tentativas. Espere um pouco e tente de novo.',
  now = Date.now,
  store = createMemoryRateStore(),
} = {}) {
  async function middleware(req, res, next) {
    try {
      const current = now();
      const key = keyFn(req);
      const entry = await store.hit(key, windowMs, current);
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
    } catch (err) {
      next(err);
    }
  }

  middleware.reset = () => store.reset?.();
  return middleware;
}

export function envWindowMs(fallback = 15 * 60 * 1000) {
  return positiveInt(process.env.LOGIN_RATE_WINDOW_MS, fallback);
}

export function envMaxAttempts(fallback = 10) {
  return positiveInt(process.env.LOGIN_RATE_MAX, fallback);
}
