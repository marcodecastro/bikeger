import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { enqueueReadyNotice, enqueueQuoteNotice, listNotices, markNoticeSent } from '../services/notifyService.js';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const notices = await listNotices({ status: req.query.status });
    res.json(notices);
  }),
);

notificationsRouter.post(
  '/:id/sent',
  asyncHandler(async (req, res) => {
    const notice = await markNoticeSent(req.params.id);
    res.json(notice);
  }),
);

notificationsRouter.post(
  '/work-orders/:id/ready',
  asyncHandler(async (req, res) => {
    const notice = await enqueueReadyNotice(req.params.id);
    res.status(201).json(notice);
  }),
);

notificationsRouter.post(
  '/work-orders/:id/quote',
  asyncHandler(async (req, res) => {
    const notice = await enqueueQuoteNotice(req.params.id);
    res.status(201).json(notice);
  }),
);
