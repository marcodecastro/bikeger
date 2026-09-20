import { Router } from 'express';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { assertCents } from '../utils/money.js';
import { requireCapability } from '../middleware/auth.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { searchRegex } from '../utils/searchRegex.js';
import { listLimit } from '../utils/listLimit.js';

export const productsRouter = Router();

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, category, active, lowStock } = req.query;
    const filter = {};

    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    if (category) filter.category = category;
    const rx = searchRegex(q);
    if (rx) {
      filter.$or = [
        { name: rx },
        { sku: rx },
        { barcode: rx },
        { brand: rx },
      ];
    }
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minStock'] };
    }

    const products = await Product.find(filter)
      .populate('supplier')
      .sort({ name: 1 })
      .limit(listLimit(req.query.limit, 300));

    res.json(products.map((product) => hideCostIfNeeded(product, req.user)));
  }),
);

productsRouter.get(
  '/lookup/:code',
  asyncHandler(async (req, res) => {
    const code = req.params.code.trim();
    const product = await Product.findOne({
      $or: [{ barcode: code }, { sku: code.toUpperCase() }],
      active: true,
    });
    if (!product) throw httpError(404, 'Produto não encontrado');
    res.json(hideCostIfNeeded(product, req.user));
  }),
);

productsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate('supplier');
    if (!product) throw httpError(404, 'Produto não encontrado');
    res.json(hideCostIfNeeded(product, req.user));
  }),
);

export const PRODUCT_WRITE_FIELDS = [
  'sku',
  'barcode',
  'name',
  'description',
  'category',
  'brand',
  'model',
  'unit',
  'costPrice',
  'salePrice',
  'minStock',
  'ncm',
  'cfop',
  'icmsOrigin',
  'icmsCst',
  'location',
  'supplier',
  'active',
  'images',
];

export function pickProductBody(body, { allowInitialStock = false } = {}) {
  const picked = {};
  for (const key of PRODUCT_WRITE_FIELDS) {
    if (body?.[key] !== undefined) picked[key] = body[key];
  }
  if (allowInitialStock && body?.currentStock !== undefined) {
    picked.currentStock = body.currentStock;
  }
  return picked;
}

productsRouter.post(
  '/',
  requireCapability('products.write'),
  asyncHandler(async (req, res) => {
    const body = pickProductBody(req.body, { allowInitialStock: true });
    assertCents(body.costPrice ?? 0, 'preço de custo');
    assertCents(body.salePrice ?? 0, 'preço de venda');
    const initialStock = body.currentStock ?? 0;
    const product = await Product.create({ ...body, currentStock: initialStock });
    if (Number.isInteger(initialStock) && initialStock > 0) {
      await StockMovement.create({
        product: product._id,
        sku: product.sku,
        name: product.name,
        type: 'ajuste',
        direction: 'entrada',
        quantity: initialStock,
        quantityBefore: 0,
        quantityAfter: initialStock,
        unitCost: product.costPrice,
        unitPrice: product.salePrice,
        referenceType: 'adjustment',
        notes: 'Estoque inicial do cadastro',
      });
    }
    res.status(201).json(product);
  }),
);

productsRouter.put(
  '/:id',
  requireCapability('products.write'),
  asyncHandler(async (req, res) => {
    const body = pickProductBody(req.body);
    if (body.costPrice !== undefined) assertCents(body.costPrice, 'preço de custo');
    if (body.salePrice !== undefined) assertCents(body.salePrice, 'preço de venda');

    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!product) throw httpError(404, 'Produto não encontrado');
    res.json(product);
  }),
);

productsRouter.get(
  '/:id/label',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw httpError(404, 'Produto não encontrado');
    const { buildShelfLabels } = await import('../services/printerService.js');
    res.json(await buildShelfLabels([product]));
  }),
);

productsRouter.post(
  '/labels',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body.productIds) ? req.body.productIds : [];
    if (!ids.length) throw httpError(400, 'Informe as peças da etiqueta');
    const products = await Product.find({ _id: { $in: ids } });
    if (!products.length) throw httpError(404, 'Produto não encontrado');
    const { buildShelfLabels } = await import('../services/printerService.js');
    res.json(await buildShelfLabels(products));
  }),
);
