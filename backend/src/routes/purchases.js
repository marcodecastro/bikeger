import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { operatorName, requireCapability } from '../middleware/auth.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { getPurchase, listPurchases, receivePurchase } from '../services/purchaseService.js';
import { listNeededParts } from '../services/workOrderService.js';

export const purchasesRouter = Router();

purchasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const purchases = await listPurchases({
      limit: req.query.limit,
      skip: req.query.skip,
      supplier: req.query.supplier,
      q: req.query.q,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(hideCostIfNeeded(purchases, req.user));
  }),
);

purchasesRouter.get(
  '/needed',
  asyncHandler(async (req, res) => {
    const needed = await listNeededParts({ supplierId: req.query.supplier });
    res.json(hideCostIfNeeded(needed, req.user));
  }),
);

purchasesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const purchase = await getPurchase(req.params.id);
    res.json(hideCostIfNeeded(purchase, req.user));
  }),
);

purchasesRouter.post(
  '/',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    const purchase = await receivePurchase({
      supplierId: req.body.supplierId,
      notes: req.body.notes,
      invoiceNumber: req.body.invoiceNumber,
      items: req.body.items,
      operator: operatorName(req),
    });
    res.status(201).json(hideCostIfNeeded(purchase, req.user));
  }),
);
