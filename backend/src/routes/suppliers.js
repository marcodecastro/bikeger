import { Router } from 'express';
import { Supplier } from '../models/Supplier.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { listLimit } from '../utils/listLimit.js';

export const suppliersRouter = Router();

suppliersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const suppliers = await Supplier.find().sort({ name: 1 }).limit(listLimit(_req.query.limit));
    res.json(suppliers);
  }),
);

suppliersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  }),
);

suppliersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!supplier) throw httpError(404, 'Fornecedor não encontrado');
    res.json(supplier);
  }),
);
