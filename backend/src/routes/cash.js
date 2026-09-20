import { Router } from 'express';
import { CashRegister } from '../models/CashRegister.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import {
  buildDayReport,
  closeRegister,
  getOpenRegister,
  listCashMovements,
  openRegister,
  registerCashMovement,
  withSummary,
} from '../services/cashService.js';
import { buildDayReportReceipt } from '../services/printerService.js';
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
  '/movements',
  asyncHandler(async (req, res) => {
    const movements = await listCashMovements({
      from: req.query.from,
      to: req.query.to,
      type: req.query.type,
      method: req.query.method,
      limit: req.query.limit,
    });
    res.json(movements);
  }),
);

cashRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const registers = await CashRegister.find().sort({ openedAt: -1 }).limit(30);
    res.json(registers.map(withSummary));
  }),
);

cashRouter.get(
  '/:id/day-report',
  asyncHandler(async (req, res) => {
    const register = await CashRegister.findById(req.params.id);
    if (!register) throw httpError(404, 'Caixa não encontrado');
    const day = await buildDayReport(register);
    const dayReport = await buildDayReportReceipt(day);
    res.json({ ...day, receipt: dayReport });
  }),
);

cashRouter.post(
  '/open',
  asyncHandler(async (req, res) => {
    const register = await openRegister({
      ...req.body,
      operator: operatorName(req),
      actor: req.user,
    });
    res.status(201).json(register);
  }),
);

cashRouter.post(
  '/movement',
  asyncHandler(async (req, res) => {
    const register = await registerCashMovement({
      ...req.body,
      operator: operatorName(req),
      actor: req.user,
    });
    res.status(201).json(register);
  }),
);

cashRouter.post(
  '/close',
  asyncHandler(async (req, res) => {
    const register = await closeRegister({ ...req.body, actor: req.user });
    res.json(register);
  }),
);
