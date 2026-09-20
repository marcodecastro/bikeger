import { PaymentApplyFailure } from '../models/PaymentApplyFailure.js';
import { Payment } from '../models/Payment.js';
import { log, logError } from '../utils/logger.js';
import { recordAudit } from './auditService.js';
import { enqueueJob } from '../utils/jobs.js';

export const PAYMENT_DRAIN_INTERVAL_MS = 15 * 60 * 1000;

export async function recordPaymentApplyFailed({
  mpPaymentId,
  relatedType = '',
  relatedId = null,
  localPaymentId = null,
  message = '',
}) {
  const id = String(mpPaymentId || '').trim();
  if (!id) return null;

  try {
    const open = await PaymentApplyFailure.findOne({ mpPaymentId: id, status: 'open' });
    if (open) {
      open.attempts += 1;
      open.message = message || open.message;
      open.relatedType = relatedType || open.relatedType;
      open.relatedId = relatedId || open.relatedId;
      open.localPaymentId = localPaymentId || open.localPaymentId;
      open.lastErrorAt = new Date();
      await open.save();
      log('warn', 'payment_apply_failed', {
        mpPaymentId: id,
        attempts: open.attempts,
        message,
      });
      return open;
    }

    const created = await PaymentApplyFailure.create({
      kind: 'payment_apply_failed',
      mpPaymentId: id,
      relatedType,
      relatedId,
      localPaymentId,
      message,
      status: 'open',
      attempts: 1,
      lastErrorAt: new Date(),
    });
    log('warn', 'payment_apply_failed', { mpPaymentId: id, attempts: 1, message });
    await recordAudit({
      action: 'payment.apply_failed',
      meta: { mpPaymentId: id, relatedType, message },
    });
    return created;
  } catch (error) {
    if (error.code === 11000) {
      return PaymentApplyFailure.findOne({ mpPaymentId: id, status: 'open' });
    }
    logError(error, null, { job: 'payment_apply_failed', mpPaymentId: id });
    return null;
  }
}

export async function resolvePaymentApplyFailed(mpPaymentId) {
  const id = String(mpPaymentId || '').trim();
  if (!id) return;
  await PaymentApplyFailure.updateMany(
    { mpPaymentId: id, status: 'open' },
    { $set: { status: 'resolved' } },
  );
}

export async function listOpenPaymentApplyFailures(limit = 50) {
  return PaymentApplyFailure.find({ status: 'open' }).sort({ lastErrorAt: -1 }).limit(limit);
}

export async function countOpenPaymentApplyFailures() {
  return PaymentApplyFailure.countDocuments({ status: 'open' });
}

export async function drainPaymentApplyOutbox() {
  const open = await PaymentApplyFailure.find({ status: 'open' }).sort({ lastErrorAt: 1 }).limit(50);
  const { processWebhookPayment } = await import('./mercadoPagoService.js');
  const results = { ok: 0, fail: 0, items: [] };

  for (const item of open) {
    try {
      const local = await Payment.findOne({ paymentId: String(item.mpPaymentId) });
      const options = local?.raw ? { fetchRemote: async () => local.raw } : {};
      await processWebhookPayment(item.mpPaymentId, options);
      await resolvePaymentApplyFailed(item.mpPaymentId);
      results.ok += 1;
      results.items.push({ mpPaymentId: item.mpPaymentId, ok: true });
    } catch (error) {
      results.fail += 1;
      results.items.push({
        mpPaymentId: item.mpPaymentId,
        ok: false,
        message: error.message || String(error),
      });
    }
  }

  if (results.ok || results.fail) {
    await recordAudit({
      action: 'payment.outbox_drained',
      meta: { ok: results.ok, fail: results.fail },
    });
  }

  return results;
}

export async function scheduleNextPaymentDrain() {
  const { Job } = await import('../models/Job.js');
  const exists = await Job.exists({
    name: 'payment.drain',
    status: { $in: ['pending', 'running'] },
    runAfter: { $gt: new Date() },
  });
  if (exists) return;
  await enqueueJob('payment.drain', {}, { runAfter: new Date(Date.now() + PAYMENT_DRAIN_INTERVAL_MS) });
}
