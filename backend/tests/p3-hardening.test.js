import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Customer, normalizeCustomerDocument } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { Product } from '../src/models/Product.js';
import { Sale } from '../src/models/Sale.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { LoginAttempt } from '../src/models/LoginAttempt.js';
import { customerHistory, DEFAULT_HISTORY_LIMIT } from '../src/services/historyService.js';
import { marginByCategory } from '../src/services/marginService.js';
import { accumulateByCategory, lineMargin } from '../src/utils/margin.js';
import { createMongoRateStore, createRateLimiter } from '../src/utils/rateLimit.js';
import { LOGIN_RATE_MESSAGE } from '../src/middleware/loginRateLimit.js';

const uri = process.env.MONGODB_TEST_URI_P3 || 'mongodb://127.0.0.1:27017/bikeger_test_p3';

before(async () => {
  await mongoose.connect(uri);
  await Promise.all([
    Customer.deleteMany({}),
    Bike.deleteMany({}),
    Product.deleteMany({}),
    Sale.deleteMany({}),
    WorkOrder.deleteMany({}),
    LoginAttempt.deleteMany({}),
  ]);
  await Promise.all([Customer.syncIndexes(), LoginAttempt.syncIndexes(), Product.syncIndexes()]);
});

after(async () => {
  await mongoose.disconnect();
});

function mockRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
  };
}

function call(limiter, req) {
  return new Promise((resolve) => {
    const res = mockRes();
    limiter(req, res, (err) => resolve({ err: err || null, res }));
  });
}

async function makeProduct(sku, category) {
  return Product.create({
    sku,
    barcode: sku,
    name: `Peça ${sku}`,
    category,
    costPrice: 4000,
    salePrice: 10000,
    currentStock: 10,
    minStock: 0,
    unit: 'UN',
  });
}

test('histórico pagina vendas e OS e mantém totais da aggregation', async () => {
  const customer = await Customer.create({ name: 'Histórico P3' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const product = await makeProduct('P3-HIST', 'Freios');

  const sales = [
    { number: 'VD-P3-1', total: 10000, createdAt: new Date('2026-09-03T12:00:00Z') },
    { number: 'VD-P3-2', total: 20000, createdAt: new Date('2026-09-02T12:00:00Z') },
    { number: 'VD-P3-3', total: 30000, createdAt: new Date('2026-09-01T12:00:00Z') },
  ];
  for (const sale of sales) {
    await Sale.create({
      number: sale.number,
      customer: customer._id,
      items: [
        {
          product: product._id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          quantity: 1,
          unitCost: 4000,
          unitPrice: sale.total,
          total: sale.total,
        },
      ],
      subtotal: sale.total,
      discount: 0,
      total: sale.total,
      status: 'paga',
      createdAt: sale.createdAt,
    });
  }
  await Sale.create({
    number: 'VD-P3-CANCEL',
    customer: customer._id,
    items: [],
    subtotal: 999,
    discount: 0,
    total: 999,
    status: 'cancelada',
    createdAt: new Date('2026-09-04T12:00:00Z'),
  });

  await WorkOrder.create({
    number: 'OS-P3-1',
    customer: customer._id,
    bike: bike._id,
    total: 15000,
    status: 'pronta',
    createdAt: new Date('2026-09-03T10:00:00Z'),
  });
  await WorkOrder.create({
    number: 'OS-P3-2',
    customer: customer._id,
    bike: bike._id,
    total: 7000,
    status: 'aberta',
    createdAt: new Date('2026-09-02T10:00:00Z'),
  });
  await WorkOrder.create({
    number: 'OS-P3-CANCEL',
    customer: customer._id,
    bike: bike._id,
    total: 4000,
    status: 'cancelada',
    createdAt: new Date('2026-09-01T10:00:00Z'),
  });

  const page = await customerHistory(customer._id, { salesLimit: 2, ordersLimit: 1 });
  assert.equal(DEFAULT_HISTORY_LIMIT, 50);
  assert.equal(page.sales.length, 2);
  assert.equal(page.sales[0].number, 'VD-P3-1');
  assert.equal(page.orders.length, 1);
  assert.equal(page.orders[0].number, 'OS-P3-1');
  assert.equal(page.salesTotal, 60000);
  assert.equal(page.ordersTotal, 22000);
  assert.equal(page.lifetimeValue, 82000);
  assert.equal(page.salesCount, 3);
  assert.equal(page.ordersCount, 3);
  assert.equal(page.visitCount, 6);
  assert.equal(page.salesHasMore, true);
  assert.equal(page.ordersHasMore, true);

  const full = await customerHistory(customer._id, { salesLimit: 50, ordersLimit: 50 });
  assert.equal(full.sales.length, 3);
  assert.equal(full.orders.length, 3);
  assert.equal(full.salesHasMore, false);
  assert.equal(full.ordersHasMore, false);
  assert.equal(full.salesTotal, 60000);
});

test('margem por categoria agrega no Mongo e ignora linha zerada por devolução', async () => {
  const brakes = await makeProduct('P3-MARG-F', 'Freios');
  const trans = await makeProduct('P3-MARG-T', 'Transmissão');
  const orphan = await makeProduct('P3-MARG-O', 'Pneus');

  await Sale.create({
    number: 'VD-P3-M1',
    items: [
      {
        product: brakes._id,
        sku: brakes.sku,
        name: brakes.name,
        category: 'Freios',
        quantity: 2,
        unitCost: 4000,
        unitPrice: 10000,
        total: 20000,
        returnedQuantity: 1,
      },
      {
        product: trans._id,
        sku: trans.sku,
        name: trans.name,
        category: '',
        quantity: 1,
        unitCost: 7000,
        unitPrice: 8000,
        total: 8000,
      },
    ],
    subtotal: 28000,
    discount: 0,
    total: 28000,
    status: 'paga',
    createdAt: new Date('2026-09-10T12:00:00Z'),
  });
  await Sale.create({
    number: 'VD-P3-M2',
    items: [
      {
        product: orphan._id,
        sku: orphan.sku,
        name: orphan.name,
        category: '',
        quantity: 1,
        unitCost: 2000,
        unitPrice: 5000,
        total: 5000,
        returnedQuantity: 1,
      },
    ],
    subtotal: 5000,
    discount: 0,
    total: 5000,
    status: 'devolvida',
    createdAt: new Date('2026-09-10T13:00:00Z'),
  });
  await Sale.create({
    number: 'VD-P3-M-SKIP',
    items: [
      {
        product: brakes._id,
        sku: brakes.sku,
        name: brakes.name,
        category: 'Freios',
        quantity: 1,
        unitCost: 4000,
        unitPrice: 10000,
        total: 10000,
      },
    ],
    subtotal: 10000,
    discount: 0,
    total: 10000,
    status: 'cancelada',
    createdAt: new Date('2026-09-10T14:00:00Z'),
  });

  const expected = accumulateByCategory([
    {
      category: 'Freios',
      ...lineMargin({ unitPrice: 10000, unitCost: 4000, quantity: 2, returnedQuantity: 1 }),
    },
    {
      category: 'Transmissão',
      ...lineMargin({ unitPrice: 8000, unitCost: 7000, quantity: 1 }),
    },
  ]);

  const rows = await marginByCategory({
    from: '2026-09-10T00:00:00Z',
    to: '2026-09-10T23:59:59Z',
  });
  assert.deepEqual(rows, expected);
  assert.equal(rows[0].category, 'Freios');
  assert.equal(rows[0].profit, 6000);
  assert.equal(rows[0].quantity, 1);
  assert.equal(rows[1].category, 'Transmissão');
  assert.equal(rows[1].profit, 1000);
});

test('CPF vazio pode repetir e máscara não fura o unique', async () => {
  assert.equal(normalizeCustomerDocument('123.456.789-00'), '12345678900');
  await Customer.create({ name: 'Sem CPF A', document: '' });
  await Customer.create({ name: 'Sem CPF B', document: '' });

  const saved = await Customer.create({ name: 'Com CPF', document: '123.456.789-00' });
  assert.equal(saved.document, '12345678900');
  await assert.rejects(
    () => Customer.create({ name: 'Duplicado', document: '12345678900' }),
    (err) => err?.code === 11000 && err.keyPattern?.document === 1,
  );
});

test('código de barras vazio pode repetir e preenchido fica unique', async () => {
  await Product.create({
    sku: 'P3-BAR-A',
    barcode: '',
    name: 'Sem código A',
    category: 'Teste',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: 1,
    minStock: 0,
    unit: 'UN',
  });
  await Product.create({
    sku: 'P3-BAR-B',
    barcode: '',
    name: 'Sem código B',
    category: 'Teste',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: 1,
    minStock: 0,
    unit: 'UN',
  });
  await Product.create({
    sku: 'P3-BAR-C',
    barcode: '7891234567890',
    name: 'Com código',
    category: 'Teste',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: 1,
    minStock: 0,
    unit: 'UN',
  });
  await assert.rejects(
    () =>
      Product.create({
        sku: 'P3-BAR-D',
        barcode: '7891234567890',
        name: 'Duplicado',
        category: 'Teste',
        costPrice: 1000,
        salePrice: 2000,
        currentStock: 1,
        minStock: 0,
        unit: 'UN',
      }),
    (err) => err?.code === 11000 && err.keyPattern?.barcode === 1,
  );
});

test('rate limit de login persiste o bucket no Mongo', async () => {
  const store = createMongoRateStore(LoginAttempt);
  const limiter = createRateLimiter({
    windowMs: 100,
    max: 1,
    message: LOGIN_RATE_MESSAGE,
    now: () => now,
    store,
  });
  let now = 1_000;
  const req = { ip: '10.0.0.9', body: { login: 'p3-dono' } };

  assert.equal((await call(limiter, req)).err, null);
  const blocked = await call(limiter, req);
  assert.equal(blocked.err.status, 429);
  assert.equal(blocked.err.message, LOGIN_RATE_MESSAGE);

  const saved = await LoginAttempt.findById('10.0.0.9|p3-dono');
  assert.equal(saved.count, 2);

  now = 1_101;
  assert.equal((await call(limiter, req)).err, null);
});
