import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { Service } from '../src/models/Service.js';
import { Sale } from '../src/models/Sale.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { cancelSale, createSale, saleLaborTotal, salePartsTotal } from '../src/services/saleService.js';
import { buildReceipt } from '../src/services/printerService.js';
import { ensureOpenRegister } from './helpers/openCash.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
  await ensureOpenRegister();
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

test('cupom misturado sem cliente: serviço não reserva estoque e peça baixa', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const product = await Product.create({
    sku: `BAL-${suffix}`,
    barcode: `B${suffix}`,
    name: 'Pastilha',
    category: 'Freio',
    costPrice: 2000,
    salePrice: 5000,
    currentStock: 6,
    minStock: 0,
    unit: 'UN',
  });
  const catalog = await Service.create({
    name: `Regulagem ${suffix}`,
    price: 4500,
    category: 'Ajuste',
    active: true,
  });

  const sale = await createSale({
    customer: null,
    items: [
      { product: product._id, quantity: 1 },
      { serviceId: catalog._id, quantity: 1 },
      { kind: 'servico', name: 'Sangria avulsa', price: 8000, quantity: 1 },
    ],
    payments: [{ method: 'dinheiro', amount: 17500 }],
    operator: 'teste',
  });

  assert.equal(sale.customer, null);
  assert.equal(sale.items.length, 3);
  assert.equal(sale.items.filter((item) => item.kind === 'servico').length, 2);
  assert.equal(saleLaborTotal(sale.items), 12500);
  assert.equal(salePartsTotal(sale.items), 5000);
  assert.equal(sale.total, 17500);

  const stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 5);
  assert.equal(stock.reservedStock || 0, 0);

  const movements = await StockMovement.find({ referenceId: sale._id, type: 'venda' });
  assert.equal(movements.length, 1);

  const receipt = await buildReceipt({
    kind: 'sale',
    number: sale.number,
    customerName: sale.customer?.name,
    items: sale.items,
    totals: {
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      laborTotal: saleLaborTotal(sale.items),
      partsTotal: salePartsTotal(sale.items),
    },
    payments: sale.payments.map((payment) => ({ method: payment.method, amount: payment.amount })),
  });
  assert.match(receipt.text, /CUPOM NAO FISCAL/);
  assert.match(receipt.text, /Consumidor/);
  assert.match(receipt.text, /Servicos/);

  await cancelSale(sale._id, { operator: 'teste', notes: 'teste' });
  const afterCancel = await Product.findById(product._id);
  assert.equal(afterCancel.currentStock, 6);
  const cancelled = await Sale.findById(sale._id);
  assert.equal(cancelled.status, 'cancelada');
});
