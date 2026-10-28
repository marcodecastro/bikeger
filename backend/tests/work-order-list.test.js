import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { createWorkOrder, listWorkOrders } from '../src/services/workOrderService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI_WOL || 'mongodb://127.0.0.1:27017/bikeger_test_wol';

before(async () => {
  await mongoose.connect(uri);
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

async function seed() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const customer = await Customer.create({
    name: `Clara Lista ${suffix}`,
    phone: '11970001111',
  });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Sense',
    model: `Impact ${suffix}`,
    serialNumber: `SN${suffix}`,
    type: 'mtb',
  });
  const order = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'troca de corrente',
    mechanic: 'Paulo',
  });
  return { customer, bike, order, suffix };
}

test('lista OS entregue e acha por número, cliente ou bike', async () => {
  const { order, suffix } = await seed();
  await WorkOrder.updateOne({ _id: order._id }, { $set: { status: 'entregue', deliveredAt: new Date() } });

  const delivered = await listWorkOrders({ status: 'entregue' });
  assert.ok(delivered.some((item) => String(item._id) === String(order._id)));

  const byNumber = await listWorkOrders({ q: order.number });
  assert.equal(byNumber.length, 1);
  assert.equal(byNumber[0].number, order.number);

  const byCustomer = await listWorkOrders({ q: `Clara Lista ${suffix}` });
  assert.ok(byCustomer.some((item) => String(item._id) === String(order._id)));

  const byBike = await listWorkOrders({ q: `Impact ${suffix}` });
  assert.ok(byBike.some((item) => String(item._id) === String(order._id)));
});
