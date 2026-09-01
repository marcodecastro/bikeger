import { Router } from 'express';
import { Payment } from '../models/Payment.js';
import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import {
  createCheckoutPreference,
  createPixPayment,
  syncPaymentStatus,
} from '../services/mercadoPagoService.js';
import { verifyMercadoPagoWebhook } from '../utils/mercadoPagoWebhook.js';

export const paymentsRouter = Router();

paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { relatedType, relatedId } = req.query;
    const filter = {};
    if (relatedType) filter.relatedType = relatedType;
    if (relatedId) filter.relatedId = relatedId;
    const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(payments);
  }),
);

paymentsRouter.post(
  '/preference',
  asyncHandler(async (req, res) => {
    const { relatedType, relatedId } = req.body;
    const { title, amount, email } = await resolveCharge(relatedType, relatedId);
    const result = await createCheckoutPreference({
      relatedType,
      relatedId,
      title,
      amount,
      payerEmail: email,
    });
    res.status(201).json(result);
  }),
);

paymentsRouter.post(
  '/pix',
  asyncHandler(async (req, res) => {
    const { relatedType, relatedId } = req.body;
    const { title, amount, email } = await resolveCharge(relatedType, relatedId);
    const payment = await createPixPayment({
      relatedType,
      relatedId,
      title,
      amount,
      payerEmail: email,
    });
    res.status(201).json(payment);
  }),
);

export const mercadoPagoWebhook = asyncHandler(async (req, res) => {
  verifyMercadoPagoWebhook(req);
  const paymentId = req.body?.data?.id || req.query.id;
  if (paymentId) {
    await syncPaymentStatus(paymentId).catch((error) => {
      console.error('Webhook Mercado Pago:', error.message);
    });
  }
  res.sendStatus(200);
});

paymentsRouter.post(
  '/:paymentId/sync',
  asyncHandler(async (req, res) => {
    const payment = await syncPaymentStatus(req.params.paymentId);
    res.json(payment);
  }),
);

async function resolveCharge(relatedType, relatedId) {
  if (relatedType === 'sale') {
    const sale = await Sale.findById(relatedId).populate('customer');
    if (!sale) throw httpError(404, 'Venda não encontrada');
    const open = sale.total - sale.paidAmount;
    if (open <= 0) throw httpError(400, 'Venda já está paga');
    return {
      title: `Venda ${sale.number}`,
      amount: open,
      email: sale.customer?.email,
    };
  }

  if (relatedType === 'workOrder') {
    const order = await WorkOrder.findById(relatedId).populate('customer');
    if (!order) throw httpError(404, 'OS não encontrada');
    const open = order.total - order.paidAmount;
    if (open <= 0) throw httpError(400, 'OS já está paga');
    return {
      title: `OS ${order.number}`,
      amount: open,
      email: order.customer?.email,
    };
  }

  throw httpError(400, 'Tipo de cobrança inválido');
}
