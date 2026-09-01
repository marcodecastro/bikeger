import { Router } from 'express';
import { Customer } from '../models/Customer.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { customerHistory } from '../services/historyService.js';
import { requireCapability } from '../middleware/auth.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { searchRegex } from '../utils/searchRegex.js';
import { listLimit } from '../utils/listLimit.js';

export const customersRouter = Router();

customersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    const filter = {};
    const rx = searchRegex(q);
    if (rx) {
      filter.$or = [
        { name: rx },
        { phone: rx },
        { document: rx },
        { email: rx },
      ];
    }
    const customers = await Customer.find(filter).sort({ name: 1 }).limit(listLimit(req.query.limit));
    res.json(customers);
  }),
);

customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw httpError(404, 'Cliente não encontrado');
    const history = await customerHistory(customer._id);
    res.json(hideCostIfNeeded({ customer, ...history }, req.user));
  }),
);

customersRouter.post(
  '/',
  requireCapability('customers'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  }),
);

customersRouter.put(
  '/:id',
  requireCapability('customers'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!customer) throw httpError(404, 'Cliente não encontrado');
    res.json(customer);
  }),
);
