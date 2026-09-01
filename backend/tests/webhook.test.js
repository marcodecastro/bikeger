import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  verifyMercadoPagoWebhook,
  WEBHOOK_EXPIRED_MESSAGE,
  WEBHOOK_MAX_AGE_MS,
} from '../src/utils/mercadoPagoWebhook.js';

function signedRequest({ ts = String(Math.floor(Date.now() / 1000)), dataId = '12345', requestId = 'req-1', secret = 'segredo-teste' } = {}) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  return {
    headers: {
      'x-signature': `ts=${ts},v1=${hash}`,
      'x-request-id': requestId,
    },
    body: { data: { id: dataId } },
    query: {},
  };
}

test('rejeita webhook sem assinatura quando o secret existe', () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = 'segredo-teste';
  process.env.NODE_ENV = 'development';
  assert.throws(
    () => verifyMercadoPagoWebhook({ headers: {}, body: {}, query: {} }),
    /ausente/,
  );
  process.env.MP_WEBHOOK_SECRET = previous;
});

test('aceita assinatura HMAC válida dentro da janela', () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = 'segredo-teste';
  assert.doesNotThrow(() => verifyMercadoPagoWebhook(signedRequest()));
  process.env.MP_WEBHOOK_SECRET = previous;
});

test('rejeita HMAC adulterado', () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = 'segredo-teste';
  const req = signedRequest();
  req.headers['x-signature'] = req.headers['x-signature'].replace(/v1=/, 'v1=aa');
  assert.throws(() => verifyMercadoPagoWebhook(req), /inválida/);
  process.env.MP_WEBHOOK_SECRET = previous;
});

test('rejeita webhook com timestamp velho (replay)', () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = 'segredo-teste';
  const oldTs = String(Math.floor((Date.now() - WEBHOOK_MAX_AGE_MS - 1000) / 1000));
  assert.throws(
    () => verifyMercadoPagoWebhook(signedRequest({ ts: oldTs })),
    (error) => error.message === WEBHOOK_EXPIRED_MESSAGE && error.status === 401,
  );
  process.env.MP_WEBHOOK_SECRET = previous;
});
