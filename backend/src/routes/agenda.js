import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listAgenda, weekFrom } from '../services/agendaService.js';

export const agendaRouter = Router();

agendaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const anchor = req.query.from || req.query.week;
    const range = req.query.from && req.query.to
      ? { from: req.query.from, to: req.query.to }
      : weekFrom(anchor ? new Date(anchor) : new Date());
    const agenda = await listAgenda(range);
    res.json(agenda);
  }),
);
