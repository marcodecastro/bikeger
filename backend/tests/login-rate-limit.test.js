import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, loginAttemptKey } from '../src/utils/rateLimit.js';
import { LOGIN_RATE_MESSAGE } from '../src/middleware/loginRateLimit.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
  };
}

function call(limiter, req) {
  return new Promise((resolve) => {
    const res = mockRes();
    limiter(req, res, (err) => resolve({ err: err || null, res }));
  });
}

test('chave do login junta IP e usuário normalizado', () => {
  assert.equal(
    loginAttemptKey({ ip: '10.0.0.8', body: { login: ' Dono ' } }),
    '10.0.0.8|dono',
  );
});

test('libera até o máximo e recusa o resto com 429', async () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 3,
    message: LOGIN_RATE_MESSAGE,
    now: () => 1_000,
  });
  const req = { ip: '127.0.0.1', body: { login: 'dono' } };

  const first = await call(limiter, req);
  const second = await call(limiter, req);
  const third = await call(limiter, req);
  const blocked = await call(limiter, req);

  assert.equal(first.err, null);
  assert.equal(second.err, null);
  assert.equal(third.err, null);
  assert.equal(blocked.err.status, 429);
  assert.equal(blocked.err.message, LOGIN_RATE_MESSAGE);
  assert.equal(blocked.res.headers['Retry-After'], '60');
  assert.equal(blocked.res.headers['X-RateLimit-Remaining'], '0');
});

test('depois da janela o IP+login pode tentar de novo', async () => {
  let now = 0;
  const limiter = createRateLimiter({
    windowMs: 100,
    max: 1,
    now: () => now,
  });
  const req = { ip: '127.0.0.1', body: { login: 'dono' } };

  assert.equal((await call(limiter, req)).err, null);
  assert.equal((await call(limiter, req)).err.status, 429);

  now = 101;
  assert.equal((await call(limiter, req)).err, null);
});

test('login diferente no mesmo IP tem bucket próprio', async () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => 1 });

  const dono = await call(limiter, { ip: '10.0.0.1', body: { login: 'dono' } });
  const balcao = await call(limiter, { ip: '10.0.0.1', body: { login: 'balcao' } });
  const donoAgain = await call(limiter, { ip: '10.0.0.1', body: { login: 'dono' } });

  assert.equal(dono.err, null);
  assert.equal(balcao.err, null);
  assert.equal(donoAgain.err.status, 429);
});

test('mesmo login em IP diferente não compartilha o limite', async () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => 1 });

  const a = await call(limiter, { ip: '10.0.0.1', body: { login: 'dono' } });
  const b = await call(limiter, { ip: '10.0.0.2', body: { login: 'dono' } });

  assert.equal(a.err, null);
  assert.equal(b.err, null);
});
