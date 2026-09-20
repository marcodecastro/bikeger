import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { monthReport } from '../services/reportService.js';

export const reportsRouter = Router();

reportsRouter.get(
  '/month',
  asyncHandler(async (req, res) => {
    const report = await monthReport({
      year: req.query.year,
      month: req.query.month,
    });
    res.json(report);
  }),
);
