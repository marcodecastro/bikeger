import { Router } from 'express';
import { WorkOrder } from '../models/WorkOrder.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import {
  addPartToWorkOrder,
  addPaymentToWorkOrder,
  addServiceToWorkOrder,
  cancelWorkOrder,
  consumePartOnWorkOrder,
  createWorkOrder,
  populateOrder,
  removePartFromWorkOrder,
  removeServiceFromWorkOrder,
  updateWorkOrder,
} from '../services/workOrderService.js';
import { buildReceipt } from '../services/printerService.js';
import { operatorName, requireCapability } from '../middleware/auth.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { listLimit } from '../utils/listLimit.js';
import { getSettings } from '../models/Settings.js';

function jsonWithoutCost(req, res, data, status = 200) {
  res.status(status).json(hideCostIfNeeded(data, req.user));
}

export const workOrdersRouter = Router();

workOrdersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, customer, bike } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (bike) filter.bike = bike;
    const orders = await WorkOrder.find(filter)
      .populate('customer')
      .populate('bike')
      .sort({ createdAt: -1 })
      .limit(listLimit(req.query.limit));
    jsonWithoutCost(req, res, orders);
  }),
);

workOrdersRouter.get(
  '/mechanics',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    const names = (settings.mechanicNames || []).map((name) => String(name).trim()).filter(Boolean);
    res.json({ mechanicNames: names.length ? names : ['Oficina'] });
  }),
);

workOrdersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await populateOrder(req.params.id);
    if (!order) throw httpError(404, 'OS não encontrada');
    jsonWithoutCost(req, res, order);
  }),
);

workOrdersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const order = await createWorkOrder(req.body);
    jsonWithoutCost(req, res, order, 201);
  }),
);

workOrdersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await updateWorkOrder(req.params.id, req.body, operatorName(req));
    jsonWithoutCost(req, res, order);
  }),
);

workOrdersRouter.post(
  '/:id/parts',
  asyncHandler(async (req, res) => {
    const order = await addPartToWorkOrder(req.params.id, {
      ...req.body,
      operator: operatorName(req),
    });
    jsonWithoutCost(req, res, order, 201);
  }),
);

workOrdersRouter.post(
  '/:id/parts/:partId/consume',
  asyncHandler(async (req, res) => {
    const order = await consumePartOnWorkOrder(req.params.id, req.params.partId, operatorName(req));
    jsonWithoutCost(req, res, order);
  }),
);

workOrdersRouter.delete(
  '/:id/parts/:partId',
  asyncHandler(async (req, res) => {
    const order = await removePartFromWorkOrder(req.params.id, req.params.partId, operatorName(req));
    jsonWithoutCost(req, res, order);
  }),
);

workOrdersRouter.post(
  '/:id/services',
  asyncHandler(async (req, res) => {
    const order = await addServiceToWorkOrder(req.params.id, req.body);
    jsonWithoutCost(req, res, order, 201);
  }),
);

workOrdersRouter.delete(
  '/:id/services/:serviceItemId',
  asyncHandler(async (req, res) => {
    const order = await removeServiceFromWorkOrder(req.params.id, req.params.serviceItemId);
    jsonWithoutCost(req, res, order);
  }),
);

workOrdersRouter.post(
  '/:id/payments',
  requireCapability('payments'),
  asyncHandler(async (req, res) => {
    const order = await addPaymentToWorkOrder(req.params.id, req.body);
    jsonWithoutCost(req, res, order, 201);
  }),
);

workOrdersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await cancelWorkOrder(req.params.id, operatorName(req));
    jsonWithoutCost(req, res, order);
  }),
);

workOrdersRouter.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const order = await populateOrder(req.params.id);
    if (!order) throw httpError(404, 'OS não encontrada');
    const items = [
      ...order.services.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
      })),
      ...order.parts.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    ];
    const receipt = await buildReceipt({
      kind: 'os',
      number: order.number,
      customerName: order.customer?.name,
      items,
      totals: {
        laborTotal: order.laborTotal,
        partsTotal: order.partsTotal,
        subtotal: order.laborTotal + order.partsTotal,
        discount: order.discount,
        total: order.total,
      },
      payments: order.payments.map((payment) => ({
        method: payment.method,
        amount: payment.amount,
      })),
      extraLines: [
        order.bike ? `Bike: ${order.bike.brand} ${order.bike.model}` : '',
        order.complaint ? `Relato: ${order.complaint}` : '',
        order.diagnosis ? `Diagnostico: ${order.diagnosis}` : '',
      ].filter(Boolean),
    });
    res.json(receipt);
  }),
);
