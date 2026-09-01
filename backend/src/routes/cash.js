import { Router } from 'express';
import { CashRegister } from '../models/CashRegister.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  closeRegister,
  getOpenRegister,
  openRegister,
  registerCashMovement,
  withSummary,
} from '../services/cashService.js';
import { operatorName } from '../middleware/auth.js';

export const cashRouter = Router();

cashRouter.get(
  '/current',
  asyncHandler(async (_req, res) => {
    const register = await getOpenRegister();
    res.json(withSummary(register));
  }),
);

cashRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const registers = await CashRegister.find().sort({ openedAt: -1 }).limit(30);
    res.json(registers.map(withSummary));
  }),
);

cashRouter.post(
  '/open',
  asyncHandler(async (req, res) => {
    const register = await openRegister({ ...req.body, operator: operatorName(req) });
    res.status(201).json(register);
  }),
);

cashRouter.post(
  '/movement',
  asyncHandler(async (req, res) => {
    const register = await registerCashMovement(req.body);
    res.status(201).json(register);
  }),
);

cashRouter.post(
  '/close',
  asyncHandler(async (req, res) => {
    const register = await closeRegister(req.body);
    res.json(register);
  }),
);
