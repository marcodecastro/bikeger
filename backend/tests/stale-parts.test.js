import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { AuditEvent } from '../src/models/AuditEvent.js';
import { createWorkOrder, updateWorkOrder } from '../src/services/workOrderService.js';
import { flagStaleWaitingParts } from '../src/services/stalePartsService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

test('job marca OS parada em aguardando peças', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const customer = await Customer.create({ name: `Cliente stale ${suffix}`, phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Scott',
    model: 'Scale',
    type: 'mtb',
  });
  const order = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'espera peça',
  });
  await updateWorkOrder(order._id, { status: 'aguardando_pecas' });
  const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  await WorkOrder.updateOne(
    { _id: order._id },
    { $set: { partsWaitingSince: old, partsStaleNotifiedAt: null } },
  );

  const result = await flagStaleWaitingParts();
  assert.ok(result.found >= 1);

  const events = await AuditEvent.find({ action: 'workOrder.parts_waiting', 'meta.orderId': String(order._id) });
  assert.equal(events.length, 1);

  await flagStaleWaitingParts();
  const again = await AuditEvent.find({ action: 'workOrder.parts_waiting', 'meta.orderId': String(order._id) });
  assert.equal(again.length, 1);
});
