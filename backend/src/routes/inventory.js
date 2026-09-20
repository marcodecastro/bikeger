import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { operatorName, requireCapability } from '../middleware/auth.js';
import {
  applyInventoryCount,
  cancelInventoryCount,
  getInventoryCount,
  listInventoryCounts,
  scanInventoryItem,
  setInventoryItemQty,
  startInventoryCount,
} from '../services/inventoryService.js';

export const inventoryRouter = Router();

inventoryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const counts = await listInventoryCounts({ limit: req.query.limit, status: req.query.status });
    res.json(counts);
  }),
);

inventoryRouter.post(
  '/',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    const count = await startInventoryCount({
      notes: req.body.notes,
      operator: operatorName(req),
    });
    res.status(201).json(count);
  }),
);

inventoryRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await getInventoryCount(req.params.id));
  }),
);

inventoryRouter.post(
  '/:id/scan',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    const count = await scanInventoryItem(req.params.id, {
      code: req.body.code,
      productId: req.body.productId,
      quantity: req.body.quantity ?? 1,
    });
    res.json(count);
  }),
);

inventoryRouter.patch(
  '/:id/items/:productId',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    const count = await setInventoryItemQty(req.params.id, req.params.productId, req.body.countedQty);
    res.json(count);
  }),
);

inventoryRouter.post(
  '/:id/apply',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    res.json(await applyInventoryCount(req.params.id, operatorName(req)));
  }),
);

inventoryRouter.post(
  '/:id/cancel',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    res.json(await cancelInventoryCount(req.params.id));
  }),
);
