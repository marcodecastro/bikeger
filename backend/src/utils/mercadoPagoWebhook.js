import { createHmac, timingSafeEqual } from 'node:crypto';
import { httpError } from './asyncHandler.js';

export const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;
export const WEBHOOK_EXPIRED_MESSAGE = 'Assinatura do webhook Mercado Pago expirada';

function webhookMaxAgeMs() {
  const n = Number(process.env.MP_WEBHOOK_MAX_AGE_MS);
  return Number.isInteger(n) && n > 0 ? n : WEBHOOK_MAX_AGE_MS;
}

/**
 * Valida x-signature do Mercado Pago e recusa replay velho.
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function verifyMercadoPagoWebhook(req, { now = Date.now } = {}) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw httpError(503, 'MP_WEBHOOK_SECRET é obrigatório em produção');
    }
    console.warn('MP_WEBHOOK_SECRET vazio — webhook aceito só em desenvolvimento');
    return;
  }

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!signature || !requestId) {
    throw httpError(401, 'Assinatura do webhook Mercado Pago ausente');
  }

  const parts = Object.fromEntries(
    String(signature)
      .split(',')
      .map((chunk) => {
        const [key, ...rest] = chunk.split('=');
        return [key.trim(), rest.join('=').trim()];
      }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  const dataId = req.body?.data?.id || req.query.id;
  if (!ts || !hash || !dataId) {
    throw httpError(401, 'Assinatura do webhook Mercado Pago incompleta');
  }

  const tsMs = Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(now() - tsMs) > webhookMaxAgeMs()) {
    throw httpError(401, WEBHOOK_EXPIRED_MESSAGE);
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expected, 'hex');
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw httpError(401, 'Assinatura do webhook Mercado Pago inválida');
  }
}
