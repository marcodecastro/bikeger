import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { FiscalDocument } from '../src/models/FiscalDocument.js';
import { addPartToWorkOrder, addServiceToWorkOrder, createWorkOrder, updateWorkOrder } from '../src/services/workOrderService.js';
import { enqueueFiscalDocument } from '../src/services/fiscalService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI_WON || 'mongodb://127.0.0.1:27017/bikeger_test_won';

before(async () => {
  await mongoose.connect(uri);
  await FiscalDocument.syncIndexes();
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

test('OS com peça e serviço gera rascunho de NFC-e', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const product = await Product.create({
    sku: `NFCE-${suffix}`,
    name: 'Cabo NFC-e',
    category: 'Transmissão',
    costPrice: 800,
    salePrice: 1990,
    currentStock: 4,
    minStock: 0,
    unit: 'UN',
  });
  const customer = await Customer.create({ name: `Ana Nota ${suffix}`, phone: '11988880000' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'speed',
  });
  const order = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'marcha',
  });
  await updateWorkOrder(order._id, { status: 'diagnostico' });
  await addServiceToWorkOrder(order._id, { name: 'Regulagem', price: 8000, quantity: 1 });
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 });

  const doc = await enqueueFiscalDocument({ relatedType: 'workOrder', relatedId: order._id });
  assert.equal(doc.relatedType, 'workOrder');
  assert.equal(doc.kind, 'nfce');
  assert.equal(doc.amount, 9990);
});
