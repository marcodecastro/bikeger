import mongoose from 'mongoose';
import { MercadoPagoConfig, Preference, Payment as MpPayment } from 'mercadopago';
import { Payment } from '../models/Payment.js';
import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { getSettings } from '../models/Settings.js';
import { centsToMpAmount, mpAmountToCents, assertCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { checkoutBackUrls, publicApiUrl } from '../utils/security.js';
import { registerLedgerMovement, requireOpenRegister } from './cashService.js';
import { enqueueFiscalDocument } from './fiscalService.js';
import { WORK_ORDER_TERMINAL_STATUSES } from '../utils/workOrderStatus.js';

export const OPEN_CHARGE_STATUSES = ['pending', 'in_process'];

const CHARGE_IN_PROGRESS = 'Cobrança Mercado Pago já está sendo gerada. Aguarde um instante e tente de novo.';
const CHARGE_AMOUNT_CHANGED =
  'Já existe uma cobrança Mercado Pago em aberto para este documento, com outro valor. Aguarde o pagamento ou a expiração antes de gerar outra.';

async function getClient() {
  const settings = await getSettings();
  const accessToken = process.env.MP_ACCESS_TOKEN || settings.mpAccessToken;
  if (!accessToken) {
    throw httpError(
      400,
      'Configure o Access Token do Mercado Pago em Ajustes ou na variável MP_ACCESS_TOKEN',
    );
  }
  return new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
}

export function findOpenCharge(relatedType, relatedId) {
  const id =
    relatedId && mongoose.isValidObjectId(relatedId)
      ? new mongoose.Types.ObjectId(String(relatedId))
      : relatedId;
  return Payment.findOne({
    relatedType,
    relatedId: id,
    status: { $in: OPEN_CHARGE_STATUSES },
  }).sort({ createdAt: -1 });
}

function isChargeReady(payment) {
  return Boolean(payment?.qrCode || payment?.paymentId || payment?.ticketUrl || payment?.preferenceId);
}

function reuseOrConflict(existing, amount) {
  if (!existing) return null;
  if (existing.amount !== amount) throw httpError(409, CHARGE_AMOUNT_CHANGED);
  if (isChargeReady(existing)) return existing;
  throw httpError(409, CHARGE_IN_PROGRESS);
}

async function occupyChargeSlot({ relatedType, relatedId, amount }) {
  const existing = await findOpenCharge(relatedType, relatedId);
  const reused = reuseOrConflict(existing, amount);
  if (reused) return { slot: reused, reused: true };

  try {
    const slot = await Payment.create({
      provider: 'mercado_pago',
      status: 'pending',
      amount,
      relatedType,
      relatedId,
    });
    return { slot, reused: false };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const open = await findOpenCharge(relatedType, relatedId);
    const recovered = reuseOrConflict(open, amount);
    if (recovered) return { slot: recovered, reused: true };
    throw httpError(409, CHARGE_IN_PROGRESS);
  }
}

async function saveOccupiedSlot(slot) {
  try {
    await slot.save();
    return slot;
  } catch (error) {
    if (error.code === 11000 && slot.paymentId) {
      const existing = await Payment.findOne({ paymentId: slot.paymentId });
      await Payment.deleteOne({ _id: slot._id }).catch(() => undefined);
      if (existing) return existing;
    }
    await Payment.deleteOne({ _id: slot._id }).catch(() => undefined);
    throw error;
  }
}

async function fillChargeSlot(slot, work) {
  try {
    return await work(slot);
  } catch (error) {
    await Payment.deleteOne({ _id: slot._id }).catch(() => undefined);
    throw error;
  }
}

async function createRemotePreference({ relatedType, relatedId, title, amount, payerEmail }) {
  const client = await getClient();
  const preference = new Preference(client);
  const backUrls = checkoutBackUrls();
  return preference.create({
    body: {
      items: [
        {
          id: String(relatedId),
          title: title.slice(0, 120),
          quantity: 1,
          unit_price: centsToMpAmount(amount),
          currency_id: 'BRL',
        },
      ],
      payer: payerEmail ? { email: payerEmail } : undefined,
      back_urls: backUrls,
      auto_return: 'approved',
      metadata: { relatedType, relatedId: String(relatedId) },
      notification_url: `${publicApiUrl()}/api/payments/webhook`,
      external_reference: `${relatedType}:${relatedId}`,
    },
  });
}

async function createRemotePix({ relatedType, relatedId, title, amount, payerEmail }) {
  const client = await getClient();
  const api = new MpPayment(client);
  return api.create({
    body: {
      transaction_amount: centsToMpAmount(amount),
      description: title.slice(0, 120),
      payment_method_id: 'pix',
      payer: {
        email: payerEmail || 'cliente@bikeger.local',
      },
      metadata: { relatedType, relatedId: String(relatedId) },
      external_reference: `${relatedType}:${relatedId}`,
      notification_url: `${publicApiUrl()}/api/payments/webhook`,
    },
  });
}

export async function createCheckoutPreference({
  relatedType,
  relatedId,
  title,
  amount,
  payerEmail,
  chargeRemote,
}) {
  assertCents(amount, 'valor Mercado Pago');
  const { slot, reused } = await occupyChargeSlot({ relatedType, relatedId, amount });
  if (reused) {
    return {
      payment: slot,
      initPoint: slot.ticketUrl,
      sandboxInitPoint: slot.raw?.sandbox_init_point || '',
    };
  }

  const created = await fillChargeSlot(slot, () =>
    (chargeRemote || createRemotePreference)({ relatedType, relatedId, title, amount, payerEmail }),
  );

  slot.preferenceId = created.id || '';
  slot.status = 'pending';
  slot.ticketUrl = created.init_point || '';
  slot.raw = created;
  const saved = await saveOccupiedSlot(slot);

  return { payment: saved, initPoint: created.init_point, sandboxInitPoint: created.sandbox_init_point };
}

export async function createPixPayment({
  relatedType,
  relatedId,
  title,
  amount,
  payerEmail,
  chargeRemote,
}) {
  assertCents(amount, 'valor PIX');
  const { slot, reused } = await occupyChargeSlot({ relatedType, relatedId, amount });
  if (reused) return slot;

  const created = await fillChargeSlot(slot, () =>
    (chargeRemote || createRemotePix)({ relatedType, relatedId, title, amount, payerEmail }),
  );

  const tx = created.point_of_interaction?.transaction_data || {};
  slot.paymentId = created.id ? String(created.id) : '';
  slot.status = created.status || 'pending';
  slot.qrCode = tx.qr_code || '';
  slot.qrCodeBase64 = tx.qr_code_base64 || '';
  slot.ticketUrl = tx.ticket_url || '';
  slot.raw = created;
  return saveOccupiedSlot(slot);
}

export async function syncPaymentStatus(mpPaymentId, { fetchRemote } = {}) {
  const remote = fetchRemote
    ? await fetchRemote(mpPaymentId)
    : await new MpPayment(await getClient()).get({ id: mpPaymentId });
  const amount = mpAmountToCents(remote.transaction_amount);
  const relatedType = remote.metadata?.relatedType || 'sale';
  const relatedId = remote.metadata?.relatedId;

  let payment = await Payment.findOne({ paymentId: String(mpPaymentId) });
  if (!payment && relatedType && relatedId) {
    payment = await findOpenCharge(relatedType, relatedId);
  }

  if (!payment) {
    try {
      payment = await Payment.create({
        provider: 'mercado_pago',
        paymentId: String(mpPaymentId),
        status: remote.status,
        amount,
        relatedType,
        relatedId,
        raw: remote,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      payment = await Payment.findOne({ paymentId: String(mpPaymentId) });
      if (!payment) throw error;
    }
  } else {
    payment.paymentId = String(mpPaymentId);
    payment.status = remote.status;
    payment.amount = amount;
    payment.raw = remote;
    await payment.save();
  }

  if (remote.status === 'approved' && payment.relatedId) {
    await applyApprovedPayment(payment, remote);
  }

  return payment;
}

export async function applyApprovedPayment(payment, remote) {
  const mpId = String(remote.id);
  assertCents(payment.amount, 'pagamento Mercado Pago');
  await requireOpenRegister();

  if (payment.relatedType === 'sale') {
    const result = await Sale.updateOne(
      {
        _id: payment.relatedId,
        'payments.mercadoPagoId': { $ne: mpId },
        $expr: {
          $lte: [{ $add: [{ $ifNull: ['$paidAmount', 0] }, payment.amount] }, '$total'],
        },
      },
      {
        $push: {
          payments: {
            _id: new mongoose.Types.ObjectId(),
            method: 'mercado_pago',
            amount: payment.amount,
            status: 'aprovado',
            mercadoPagoId: mpId,
          },
        },
        $inc: { paidAmount: payment.amount },
      },
    );
    if (result.modifiedCount === 0) return;

    const sale = await Sale.findById(payment.relatedId);
    if (!sale) return;
    if (sale.paidAmount >= sale.total) sale.status = 'paga';
    await sale.save();
    await registerLedgerMovement({
      type: 'venda',
      method: 'mercado_pago',
      amount: payment.amount,
      notes: `Venda ${sale.number}`,
      referenceId: sale._id,
    });
    if (sale.status === 'paga') {
      await enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id }).catch(() => undefined);
    }
    return;
  }

  if (payment.relatedType === 'workOrder') {
    const result = await WorkOrder.updateOne(
      {
        _id: payment.relatedId,
        status: { $nin: WORK_ORDER_TERMINAL_STATUSES },
        'payments.mercadoPagoId': { $ne: mpId },
        $expr: {
          $lte: [{ $add: [{ $ifNull: ['$paidAmount', 0] }, payment.amount] }, '$total'],
        },
      },
      {
        $push: {
          payments: {
            _id: new mongoose.Types.ObjectId(),
            method: 'mercado_pago',
            amount: payment.amount,
            status: 'aprovado',
            mercadoPagoId: mpId,
          },
        },
        $inc: { paidAmount: payment.amount },
      },
    );
    if (result.modifiedCount === 0) return;

    const order = await WorkOrder.findById(payment.relatedId);
    if (!order) return;
    await registerLedgerMovement({
      type: 'os',
      method: 'mercado_pago',
      amount: payment.amount,
      notes: `OS ${order.number}`,
      referenceId: order._id,
    });
  }
}
