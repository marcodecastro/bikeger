import { Router } from 'express';
import { Sale } from '../models/Sale.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { cancelSale, createSale, returnSale } from '../services/saleService.js';
import { buildReceipt } from '../services/printerService.js';
import { operatorName } from '../middleware/auth.js';
import { listLimit } from '../utils/listLimit.js';

export const salesRouter = Router();

salesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, customer, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const sales = await Sale.find(filter).populate('customer').sort({ createdAt: -1 }).limit(listLimit(req.query.limit));
    res.json(sales);
  }),
);

salesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id).populate('customer');
    if (!sale) throw httpError(404, 'Venda não encontrada');
    res.json(sale);
  }),
);

salesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const sale = await createSale({ ...req.body, operator: operatorName(req) });
    res.status(201).json(sale);
  }),
);

salesRouter.post(
  '/:id/return',
  asyncHandler(async (req, res) => {
    const sale = await returnSale(req.params.id, {
      ...req.body,
      operator: operatorName(req),
    });
    res.json(sale);
  }),
);

salesRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const sale = await cancelSale(req.params.id, {
      operator: operatorName(req),
      notes: req.body.notes || 'Cancelamento manual',
    });
    res.json(sale);
  }),
);

salesRouter.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id).populate('customer');
    if (!sale) throw httpError(404, 'Venda não encontrada');
    const receipt = await buildReceipt({
      kind: 'sale',
      number: sale.number,
      customerName: sale.customer?.name,
      items: sale.items,
      totals: { subtotal: sale.subtotal, discount: sale.discount, total: sale.total },
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: payment.amount,
      })),
      extraLines: sale.change ? [`Troco ${sale.change}`] : [],
    });
    res.json(receipt);
  }),
);
