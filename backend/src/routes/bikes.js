import { Router } from 'express';
import { Bike } from '../models/Bike.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { bikeHistory } from '../services/historyService.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { searchRegex } from '../utils/searchRegex.js';
import { listLimit } from '../utils/listLimit.js';

export const bikesRouter = Router();

bikesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, customer } = req.query;
    const filter = {};
    if (customer) filter.customer = customer;
    const rx = searchRegex(q);
    if (rx) {
      filter.$or = [
        { brand: rx },
        { model: rx },
        { serialNumber: rx },
      ];
    }
    const bikes = await Bike.find(filter).populate('customer').sort({ updatedAt: -1 }).limit(listLimit(req.query.limit));
    res.json(bikes);
  }),
);

bikesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bike = await Bike.findById(req.params.id).populate('customer');
    if (!bike) throw httpError(404, 'Bicicleta não encontrada');
    const history = await bikeHistory(bike._id);
    res.json(hideCostIfNeeded({ bike, ...history }, req.user));
  }),
);

bikesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const bike = await Bike.create(req.body);
    res.status(201).json(await Bike.findById(bike._id).populate('customer'));
  }),
);

bikesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const bike = await Bike.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('customer');
    if (!bike) throw httpError(404, 'Bicicleta não encontrada');
    res.json(bike);
  }),
);
