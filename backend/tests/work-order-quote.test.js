import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import {
  addPartToWorkOrder,
  addServiceToWorkOrder,
  createWorkOrder,
  updateWorkOrder,
} from '../src/services/workOrderService.js';
import { enqueueQuoteNotice } from '../src/services/notifyService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

async function seed() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const product = await Product.create({
    sku: `ORC-${suffix}`,
    barcode: `Q${suffix}`,
    name: 'Pneu orçamento',
    category: 'Pneus',
    costPrice: 8000,
    salePrice: 15990,
    currentStock: 4,
    minStock: 0,
    unit: 'UN',
  });
  const customer = await Customer.create({ name: 'Maria Orçamento', phone: '11988880000' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: 'Elite',
    type: 'mtb',
  });
  const order = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'pneu careca',
  });
  return { product, order };
}

test('peça no diagnóstico fica no orçamento e não reserva estoque', async () => {
  const { product, order } = await seed();
  await updateWorkOrder(order._id, { status: 'diagnostico' });
  const quoted = await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 });
  assert.equal(quoted.parts[0].stockStatus, 'orcamento');

  const stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 4);
  assert.equal(stock.reservedStock || 0, 0);
});

test('aprovar orçamento reserva a peça; WhatsApp leva o valor', async () => {
  const { product, order } = await seed();
  await updateWorkOrder(order._id, { status: 'diagnostico' });
  await addServiceToWorkOrder(order._id, { name: 'Troca de pneu', price: 8000, quantity: 1 });
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 });

  const notice = await enqueueQuoteNotice(order._id);
  assert.match(notice.message, /R\$ 239,90/);
  assert.equal(notice.kind, 'os_orcamento');
  const afterQuote = await WorkOrder.findById(order._id);
  assert.equal(afterQuote.status, 'orcamento');

  const approved = await updateWorkOrder(order._id, { status: 'aguardando_pecas' });
  assert.equal(approved.parts[0].stockStatus, 'reservada');
  assert.ok(approved.partsWaitingSince);

  const stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 4);
  assert.equal(stock.reservedStock, 1);
});
