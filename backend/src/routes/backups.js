import { Router } from 'express';
import express from 'express';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import {
  assertRestoreConfirm,
  listBackups,
  readBackupFile,
  restoreFromBuffer,
  restoreNamedBackup,
  RESTORE_CONFIRM,
  runBackup,
} from '../services/backupService.js';

export const backupsRouter = Router();
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;

backupsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listBackups());
  }),
);

backupsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await runBackup({ reason: 'manual', actor: req.user });
    if (result.skipped) {
      throw httpError(409, `Backup pulado (${result.reason}).`);
    }
    res.status(201).json(result);
  }),
);

backupsRouter.get(
  '/:name/file',
  asyncHandler(async (req, res) => {
    const file = await readBackupFile(req.params.name);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Length', String(file.size));
    file.stream.on('error', (err) => {
      if (!res.headersSent) res.status(500);
      res.end();
      void err;
    });
    file.stream.pipe(res);
  }),
);

backupsRouter.post(
  '/:name/restore',
  asyncHandler(async (req, res) => {
    assertRestoreConfirm(req.body?.confirm);
    const result = await restoreNamedBackup(req.params.name, { actor: req.user });
    res.json({ ok: true, confirm: RESTORE_CONFIRM, ...result });
  }),
);

backupsRouter.post(
  '/restore-upload',
  express.raw({ type: ['application/gzip', 'application/json', 'application/octet-stream'], limit: MAX_UPLOAD_BYTES }),
  asyncHandler(async (req, res) => {
    assertRestoreConfirm(req.headers['x-backup-confirm']);
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw httpError(400, 'Envie o arquivo .json.gz do backup');
    }
    const result = await restoreFromBuffer(buffer, { actor: req.user });
    res.json({ ok: true, ...result });
  }),
);
