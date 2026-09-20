import { registerJob } from '../utils/jobs.js';

registerJob('nfce.emit', async ({ docId }) => {
  const { emitFiscalDocument } = await import('../services/fiscalService.js');
  await emitFiscalDocument(docId);
});

registerJob('nfce.enqueue', async ({ relatedType, relatedId }) => {
  const { enqueueFiscalDocument } = await import('../services/fiscalService.js');
  await enqueueFiscalDocument({ relatedType, relatedId });
});

registerJob('nfce.cancel', async ({ relatedType, relatedId, reason }) => {
  const { cancelAuthorizedFor } = await import('../services/fiscalService.js');
  await cancelAuthorizedFor(relatedType, relatedId, reason);
});

registerJob('nfce.cancel-return', async ({ relatedType, relatedId, reason }) => {
  const { cancelAuthorizedFor } = await import('../services/fiscalService.js');
  await cancelAuthorizedFor(relatedType, relatedId, reason);
});

registerJob('nfce.poll', async ({ docId }) => {
  const { pollFiscalDocument } = await import('../services/fiscalService.js');
  await pollFiscalDocument(docId);
});

registerJob('os.ready-notice', async ({ orderId }) => {
  const { enqueueReadyNotice } = await import('../services/notifyService.js');
  await enqueueReadyNotice(orderId);
});

registerJob('os.opened-notice', async ({ orderId }) => {
  const { enqueueOpenedNotice } = await import('../services/notifyService.js');
  await enqueueOpenedNotice(orderId);
});

registerJob('os.paid-notice', async ({ orderId }) => {
  const { enqueuePaidNotice } = await import('../services/notifyService.js');
  await enqueuePaidNotice(orderId);
});

registerJob('payment.drain', async () => {
  const { drainPaymentApplyOutbox, scheduleNextPaymentDrain } = await import('../services/paymentOutbox.js');
  await drainPaymentApplyOutbox();
  await scheduleNextPaymentDrain();
});

registerJob('payment.apply', async ({ mpPaymentId }) => {
  const { processWebhookPayment } = await import('../services/mercadoPagoService.js');
  await processWebhookPayment(mpPaymentId);
});

registerJob('backup.daily', async () => {
  const { runBackup } = await import('../services/backupService.js');
  await runBackup({ reason: 'job' });
});

registerJob('os.parts-stale', async () => {
  const { flagStaleWaitingParts } = await import('../services/stalePartsService.js');
  await flagStaleWaitingParts();
});

registerJob('os.quote-notice', async ({ orderId }) => {
  const { enqueueQuoteNotice } = await import('../services/notifyService.js');
  await enqueueQuoteNotice(orderId);
});
