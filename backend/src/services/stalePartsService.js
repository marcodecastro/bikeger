import { WorkOrder } from '../models/WorkOrder.js';
import { getSettings } from '../models/Settings.js';
import { listStaleWaitingParts } from './workOrderService.js';
import { recordAudit } from './auditService.js';
import { enqueueJob } from '../utils/jobs.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;

export async function flagStaleWaitingParts() {
  const settings = await getSettings();
  const days = settings.waitingPartsDays || 3;
  const stale = await listStaleWaitingParts(days);
  let flagged = 0;

  for (const order of stale) {
    if (order.partsStaleNotifiedAt) continue;
    await recordAudit({
      action: 'workOrder.parts_waiting',
      actor: { login: 'sistema' },
      meta: {
        orderId: String(order._id),
        number: order.number,
        days,
        customer: order.customer?.name || '',
        bike: order.bike ? `${order.bike.brand} ${order.bike.model}` : '',
      },
    });
    await WorkOrder.updateOne({ _id: order._id }, { $set: { partsStaleNotifiedAt: new Date() } });
    flagged += 1;
  }

  await scheduleNextStaleCheck();
  return { days, found: stale.length, flagged };
}

export async function scheduleNextStaleCheck() {
  const { Job } = await import('../models/Job.js');
  const exists = await Job.exists({
    name: 'os.parts-stale',
    status: { $in: ['pending', 'running'] },
    runAfter: { $gt: new Date() },
  });
  if (exists) return;
  await enqueueJob('os.parts-stale', {}, { runAfter: new Date(Date.now() + SIX_HOURS) });
}
