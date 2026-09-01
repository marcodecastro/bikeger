import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cancelFiscalDocument, emitFiscalDocument, enqueueFiscalDocument, listFiscalDocuments } from '../services/fiscalService.js';

export const fiscalRouter = Router();

fiscalRouter.post(
  '/:id/emit',
  asyncHandler(async (req, res) => {
    const doc = await emitFiscalDocument(req.params.id);
    res.json(doc);
  }),
);

fiscalRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const doc = await cancelFiscalDocument(req.params.id, req.body.justificativa);
    res.json(doc);
  }),
);

fiscalRouter.get(
  '/:relatedType/:relatedId',
  asyncHandler(async (req, res) => {
    const docs = await listFiscalDocuments(req.params.relatedType, req.params.relatedId);
    res.json(docs);
  }),
);

fiscalRouter.post(
  '/:relatedType/:relatedId',
  asyncHandler(async (req, res) => {
    const doc = await enqueueFiscalDocument({
      relatedType: req.params.relatedType,
      relatedId: req.params.relatedId,
    });
    res.status(201).json(doc);
  }),
);
