import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { Supplier } from '../src/models/Supplier.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { InventoryCount } from '../src/models/InventoryCount.js';
import { receivePurchase } from '../src/services/purchaseService.js';
import {
  applyInventoryCount,
  scanInventoryItem,
  startInventoryCount,
} from '../src/services/inventoryService.js';
import { monthReport } from '../src/services/reportService.js';
import { buildShelfLabels } from '../src/services/printerService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

async function makeProduct(stock, cost) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return Product.create({
    sku: `LOT-${suffix}`,
    barcode: `B${suffix}`,
    name: `Peça lote ${suffix}`,
    category: 'Transmissão',
    costPrice: cost,
    salePrice: cost + 1000,
    currentStock: stock,
    minStock: 0,
    unit: 'UN',
  });
}

test('compra em lote atualiza kardex e custo médio', async () => {
  const product = await makeProduct(10, 1000);
  const supplier = await Supplier.create({ name: `Dist ${product.sku}` });

  const purchase = await receivePurchase({
    supplierId: supplier._id,
    notes: 'caixa 1',
    operator: 'teste',
    items: [{ productId: product._id, quantity: 10, unitCost: 2000 }],
  });

  assert.match(purchase.number, /^CP-/);
  assert.equal(purchase.itemsTotal, 20000);

  const stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 20);
  assert.equal(stock.costPrice, 1500);
  assert.equal(String(stock.supplier), String(supplier._id));

  const moves = await StockMovement.find({ referenceId: purchase._id, type: 'compra' });
  assert.equal(moves.length, 1);
  assert.equal(moves[0].quantity, 10);
  assert.equal(moves[0].unitCost, 2000);
});

test('contagem física aplica diferença no kardex', async () => {
  await InventoryCount.updateMany({ status: 'aberta' }, { $set: { status: 'cancelada' } });
  const product = await makeProduct(5, 1000);
  const session = await startInventoryCount({ operator: 'teste' });
  const scanned = await scanInventoryItem(session._id, { code: product.barcode, quantity: 1 });
  assert.equal(scanned.items[0].systemQty, 5);
  assert.equal(scanned.items[0].countedQty, 1);
  await scanInventoryItem(session._id, { code: product.sku, quantity: 1 });

  const applied = await applyInventoryCount(session._id, 'teste');
  assert.equal(applied.status, 'aplicada');
  assert.equal(applied.items[0].countedQty, 2);

  const stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 2);
});

test('relatório do mês e etiqueta 40x30 usam centavos', async () => {
  const now = new Date();
  const report = await monthReport({ year: now.getFullYear(), month: now.getMonth() + 1 });
  assert.equal(typeof report.sales.revenue, 'number');
  assert.equal(Number.isInteger(report.sales.margin), true);
  assert.equal(typeof report.stock.giro, 'number');

  const product = await makeProduct(1, 500);
  const labels = await buildShelfLabels([product]);
  assert.equal(labels.width, 40);
  assert.equal(labels.height, 30);
  assert.match(labels.labels[0].text, /R\$ /);
  assert.ok(labels.escposBase64.length > 10);
});
