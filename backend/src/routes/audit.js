import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listAuditEvents } from '../services/auditService.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const events = await listAuditEvents({
      action: req.query.action,
      limit: req.query.limit,
    });
    res.json(events);
  }),
);
