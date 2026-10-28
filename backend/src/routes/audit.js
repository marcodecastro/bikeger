import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listAuditEvents } from '../services/auditService.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const events = await listAuditEvents({
      action: req.query.action,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q,
      skip: req.query.skip,
      limit: req.query.limit,
    });
    res.json(events);
  }),
);
