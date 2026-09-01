import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { Sale } from '../src/models/Sale.js';
import { Counter } from '../src/models/Counter.js';
import { FiscalDocument } from '../src/models/FiscalDocument.js';
import { Customer } from '../src/models/Customer.js';
import { applyStockMovement, adjustStockTo, consumeReservation, releaseReservation, reserveStock } from '../src/services/stockService.js';
import { cancelSale, createSale, returnSale } from '../src/services/saleService.js';
import {
  addPartToWorkOrder,
  consumePartOnWorkOrder,
  createWorkOrder,
  removePartFromWorkOrder,
} from '../src/services/workOrderService.js';
import { Bike } from '../src/models/Bike.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { ensureOpenRegister } from './helpers/openCash.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
  await Promise.all([
    Product.deleteMany({}),
    StockMovement.deleteMany({}),
    Sale.deleteMany({}),
    Counter.deleteMany({}),
    FiscalDocument.deleteMany({}),
    Customer.deleteMany({}),
    Bike.deleteMany({}),
    WorkOrder.deleteMany({}),
  ]);
  await ensureOpenRegister();
});

after(async () => {
  await mongoose.disconnect();
});

async function makeProduct(sku, stock) {
  return Product.create({
    sku,
    barcode: sku,
    name: `Peça ${sku}`,
    category: 'Teste',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: stock,
    minStock: 0,
    unit: 'UN',
  });
}

test('baixa de estoque reduz currentStock e grava kardex', async () => {
  const product = await makeProduct('TST-BAIXA', 10);
  const { movement } = await applyStockMovement({
    productId: product._id,
    type: 'venda',
    direction: 'saida',
    quantity: 3,
    unitCost: 1000,
    unitPrice: 2000,
  });

  const after = await Product.findById(product._id);
  assert.equal(after.currentStock, 7);
  assert.equal(movement.quantityBefore, 10);
  assert.equal(movement.quantityAfter, 7);
  assert.equal(movement.direction, 'saida');
});

test('estorno devolve a peça ao estoque', async () => {
  const product = await makeProduct('TST-ESTORNO', 5);
  await applyStockMovement({
    productId: product._id,
    type: 'os',
    direction: 'saida',
    quantity: 2,
    unitCost: 1000,
    unitPrice: 2000,
  });
  await applyStockMovement({
    productId: product._id,
    type: 'os_estorno',
    direction: 'entrada',
    quantity: 2,
    unitCost: 1000,
    unitPrice: 2000,
  });
  const after = await Product.findById(product._id);
  assert.equal(after.currentStock, 5);
});

test('dois ajustes simultâneos para o mesmo alvo não somam o delta duas vezes', async () => {
  const product = await makeProduct('TST-AJUSTE-RACE', 10);
  await Promise.all([
    adjustStockTo({ productId: product._id, newQuantity: 15, notes: 'a' }),
    adjustStockTo({ productId: product._id, newQuantity: 15, notes: 'b' }),
  ]);
  const after = await Product.findById(product._id);
  assert.equal(after.currentStock, 15);
});

test('venda de dois itens baixa os dois; cancelar estorna os dois', async () => {
  const a = await makeProduct('TST-VENDA-A', 8);
  const b = await makeProduct('TST-VENDA-B', 4);

  const sale = await createSale({
    items: [
      { product: a._id, quantity: 2 },
      { product: b._id, quantity: 1 },
    ],
    payments: [{ method: 'pix', amount: 6000 }],
    operator: 'teste',
  });

  assert.equal(sale.status, 'paga');
  assert.equal(sale.total, 6000);
  assert.equal((await Product.findById(a._id)).currentStock, 6);
  assert.equal((await Product.findById(b._id)).currentStock, 3);

  await cancelSale(sale._id, { operator: 'teste', notes: 'teste de estorno' });
  assert.equal((await Product.findById(a._id)).currentStock, 8);
  assert.equal((await Product.findById(b._id)).currentStock, 4);
});

test('segundo item sem estoque não deixa a primeira peça pela metade', async () => {
  const a = await makeProduct('TST-ROLLBACK-A', 5);
  const b = await makeProduct('TST-ROLLBACK-B', 0);

  await assert.rejects(
    () =>
      createSale({
        items: [
          { product: a._id, quantity: 2 },
          { product: b._id, quantity: 1 },
        ],
        payments: [{ method: 'dinheiro', amount: 6000 }],
      }),
    /Estoque insuficiente/,
  );

  assert.equal((await Product.findById(a._id)).currentStock, 5);
  assert.equal((await Product.findById(b._id)).currentStock, 0);
});

test('reserva bloqueia venda e consumo baixa de verdade', async () => {
  const product = await makeProduct('TST-RESERVA', 4);
  await reserveStock({ productId: product._id, quantity: 3, notes: 'OS' });

  let after = await Product.findById(product._id);
  assert.equal(after.currentStock, 4);
  assert.equal(after.reservedStock, 3);
  assert.equal(after.availableStock, 1);

  await assert.rejects(
    () =>
      createSale({
        items: [{ product: product._id, quantity: 2 }],
        payments: [{ method: 'pix', amount: 4000 }],
      }),
    /Estoque insuficiente/,
  );

  await consumeReservation({ productId: product._id, quantity: 3 });
  after = await Product.findById(product._id);
  assert.equal(after.currentStock, 1);
  assert.equal(after.reservedStock, 0);
});

test('liberar reserva devolve o disponível sem mexer no físico', async () => {
  const product = await makeProduct('TST-LIBERA', 2);
  await reserveStock({ productId: product._id, quantity: 1 });
  await releaseReservation({ productId: product._id, quantity: 1 });
  const after = await Product.findById(product._id);
  assert.equal(after.currentStock, 2);
  assert.equal(after.reservedStock, 0);
});

test('peça na OS nasce reservada; remover libera; consumir baixa', async () => {
  const product = await makeProduct('TST-OS-RES', 5);
  const customer = await Customer.create({ name: 'Teste OS', phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const order = await createWorkOrder({ customer: customer._id, bike: bike._id, complaint: 'ruído' });
  const withPart = await addPartToWorkOrder(order._id, { productId: product._id, quantity: 2 });

  assert.equal(withPart.parts[0].stockStatus, 'reservada');
  let stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 5);
  assert.equal(stock.reservedStock, 2);

  const consumed = await consumePartOnWorkOrder(order._id, withPart.parts[0]._id);
  assert.equal(consumed.parts[0].stockStatus, 'consumida');
  stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 3);
  assert.equal(stock.reservedStock, 0);

  const other = await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 });
  const reserved = other.parts.find((part) => part.stockStatus === 'reservada');
  await removePartFromWorkOrder(order._id, reserved._id);
  stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 3);
  assert.equal(stock.reservedStock, 0);
});

test('devolução parcial devolve só o que voltou; total cancela o restante', async () => {
  const product = await makeProduct('TST-DEVOLVE', 10);
  const sale = await createSale({
    items: [{ product: product._id, quantity: 3 }],
    payments: [{ method: 'pix', amount: 6000 }],
  });

  const partial = await returnSale(sale._id, {
    items: [{ itemId: sale.items[0]._id, quantity: 1 }],
    reason: 'peça com defeito de fábrica',
    method: 'pix',
    operator: 'teste',
  });

  assert.equal(partial.status, 'paga');
  assert.equal(partial.items[0].returnedQuantity, 1);
  assert.equal((await Product.findById(product._id)).currentStock, 8);

  const full = await returnSale(sale._id, {
    items: [{ itemId: sale.items[0]._id, quantity: 2 }],
    reason: 'cliente desistiu do restante da compra',
    method: 'pix',
    operator: 'teste',
  });

  assert.equal(full.status, 'devolvida');
  assert.equal((await Product.findById(product._id)).currentStock, 10);
});
