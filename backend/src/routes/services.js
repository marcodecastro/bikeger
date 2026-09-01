import { Router } from 'express';
import { Service } from '../models/Service.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { assertCents } from '../utils/money.js';
import { requireCapability } from '../middleware/auth.js';
import { listLimit } from '../utils/listLimit.js';

export const servicesRouter = Router();

servicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { active } = req.query;
    const filter = {};
    if (active === 'true') filter.active = true;
    const services = await Service.find(filter).sort({ name: 1 }).limit(listLimit(req.query.limit));
    res.json(services);
  }),
);

servicesRouter.post(
  '/',
  requireCapability('services.write'),
  asyncHandler(async (req, res) => {
    assertCents(req.body.price ?? 0, 'preço do serviço');
    const service = await Service.create(req.body);
    res.status(201).json(service);
  }),
);

servicesRouter.put(
  '/:id',
  requireCapability('services.write'),
  asyncHandler(async (req, res) => {
    if (req.body.price !== undefined) assertCents(req.body.price, 'preço do serviço');
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!service) throw httpError(404, 'Serviço não encontrado');
    res.json(service);
  }),
);
