import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { Supplier } from '../src/models/Supplier.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import {
  addPartToWorkOrder,
  createWorkOrder,
  listNeededParts,
  updateWorkOrder,
} from '../src/services/workOrderService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI_NP || 'mongodb://127.0.0.1:27017/bikeger_test_np';

before(async () => {
  await mongoose.connect(uri);
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

test('agrega peça, quantidade e fornecedor das OS aguardando', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const supplier = await Supplier.create({ name: `Dist ${suffix}` });
  const product = await Product.create({
    sku: `WAIT-${suffix}`,
    barcode: `W${suffix}`,
    name: `Corrente espera ${suffix}`,
    category: 'Transmissão',
    costPrice: 4000,
    salePrice: 9000,
    currentStock: 3,
    minStock: 0,
    unit: 'UN',
    supplier: supplier._id,
  });
  const customer = await Customer.create({ name: `Cliente espera ${suffix}`, phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: 'Elite',
    type: 'mtb',
  });
  const first = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'corrente',
  });
  const second = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'outra corrente',
  });
  await addPartToWorkOrder(first._id, { productId: product._id, quantity: 1 });
  await addPartToWorkOrder(second._id, { productId: product._id, quantity: 2 });
  await updateWorkOrder(first._id, { status: 'aguardando_pecas' });
  await updateWorkOrder(second._id, { status: 'aguardando_pecas' });

  const needed = await listNeededParts();
  const row = needed.find((item) => item.productId === String(product._id));
  assert.ok(row);
  assert.equal(row.quantity, 3);
  assert.equal(row.sku, product.sku);
  assert.equal(row.supplierId, String(supplier._id));
  assert.equal(row.supplierName, supplier.name);
  assert.equal(row.orders.length, 2);

  const filtered = await listNeededParts({ supplierId: String(supplier._id) });
  assert.ok(filtered.some((item) => item.productId === String(product._id)));
});
