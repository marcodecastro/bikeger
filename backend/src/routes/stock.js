import { Router } from 'express';
import { StockMovement } from '../models/StockMovement.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { applyStockMovement, adjustStockTo } from '../services/stockService.js';
import { operatorName, requireCapability } from '../middleware/auth.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { listLimit, listSkip } from '../utils/listLimit.js';
import { searchRegex } from '../utils/searchRegex.js';

export const stockRouter = Router();

stockRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { product, type, q, from, to, limit = 80, skip } = req.query;
    const filter = {};
    if (product) filter.product = product;
    if (type) filter.type = type;
    const rx = searchRegex(q);
    if (rx) {
      filter.$or = [{ sku: rx }, { name: rx }];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const movements = await StockMovement.find(filter)
      .populate('product', 'name sku')
      .sort({ createdAt: -1 })
      .skip(listSkip(skip))
      .limit(listLimit(limit, 80));
    res.json(hideCostIfNeeded(movements, req.user));
  }),
);

stockRouter.post(
  '/entrada',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    const { productId, quantity, notes, unitCost } = req.body;
    const result = await applyStockMovement({
      productId,
      type: 'compra',
      direction: 'entrada',
      quantity,
      referenceType: 'purchase',
      notes: notes || 'Entrada de mercadoria',
      unitCost,
      operator: operatorName(req),
    });
    res.status(201).json(result);
  }),
);

stockRouter.post(
  '/ajuste',
  requireCapability('stock.write'),
  asyncHandler(async (req, res) => {
    const { productId, newQuantity, notes } = req.body;
    const result = await adjustStockTo({
      productId,
      newQuantity,
      notes,
      operator: operatorName(req),
    });
    res.status(result.movement ? 201 : 200).json(result);
  }),
);
