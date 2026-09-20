import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { operatorName, requireCapability } from '../middleware/auth.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { getPurchase, listPurchases, receivePurchase } from '../services/purchaseService.js';

export const purchasesRouter = Router();

purchasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const purchases = await listPurchases({ limit: req.query.limit });
    res.json(hideCostIfNeeded(purchases, req.user));
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
      items: req.body.items,
      operator: operatorName(req),
    });
    res.status(201).json(hideCostIfNeeded(purchase, req.user));
  }),
);
