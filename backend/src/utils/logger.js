import { randomUUID } from 'node:crypto';
import { isProduction } from './security.js';

export function requestIdMiddleware(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const id = incoming || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export function log(level, message, extra = {}) {
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  const payload = JSON.stringify(line);
  if (level === 'error') console.error(payload);
  else console.log(payload);
}

export function logError(err, req, extra = {}) {
  log('error', err?.message || 'Erro interno', {
    requestId: req?.id,
    status: err?.status || err?.statusCode,
    name: err?.name,
    stack: isProduction() ? undefined : err?.stack,
    ...extra,
  });
}
