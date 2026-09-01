import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { CashRegister } from '../src/models/CashRegister.js';
import { Product } from '../src/models/Product.js';
import { Sale } from '../src/models/Sale.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { Counter } from '../src/models/Counter.js';
import { StockMovement } from '../src/models/StockMovement.js';
import {
  CASH_CLOSED_MESSAGE,
  closeRegister,
  openRegister,
  registerLedgerMovement,
  reverseLedgerForReference,
  summarizeRegister,
} from '../src/services/cashService.js';
import { cancelSale, createSale } from '../src/services/saleService.js';
import {
  addPartToWorkOrder,
  addPaymentToWorkOrder,
  cancelWorkOrder,
  createWorkOrder,
} from '../src/services/workOrderService.js';

const uri = process.env.MONGODB_TEST_URI_A10 || 'mongodb://127.0.0.1:27017/bikeger_test_a10';

before(async () => {
  await mongoose.connect(uri);
  await Promise.all([
    CashRegister.deleteMany({}),
    Product.deleteMany({}),
    Sale.deleteMany({}),
    Customer.deleteMany({}),
    Bike.deleteMany({}),
    WorkOrder.deleteMany({}),
    Counter.deleteMany({}),
    StockMovement.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
});

async function resetCash() {
  await CashRegister.deleteMany({});
}

async function makeProduct() {
  const sku = `A10-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  return Product.create({
    sku,
    barcode: sku,
    name: `Peça ${sku}`,
    category: 'Teste',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: 10,
    minStock: 0,
    unit: 'UN',
  });
}

function movementsFor(register, referenceId) {
  return register.movements.filter((movement) => String(movement.referenceId) === String(referenceId));
}

test('estorno no mesmo caixa aberto continua no livro da sessão', async () => {
  await resetCash();
  await openRegister({ openingAmount: 0, operator: 'teste' });
  const referenceId = new mongoose.Types.ObjectId();
  await registerLedgerMovement({
    type: 'venda',
    method: 'pix',
    amount: 4500,
    referenceId,
  });

  await reverseLedgerForReference(referenceId);

  const register = await CashRegister.findOne({ status: 'aberto' });
  const mine = movementsFor(register, referenceId);
  assert.equal(mine.filter((movement) => movement.type === 'venda').length, 1);
  assert.equal(mine.filter((movement) => movement.type === 'estorno').length, 1);
  assert.equal(summarizeRegister(register).byMethod.pix, 0);
});

test('depois de fechar e reabrir, o estorno vai para o caixa aberto e zera o líquido do dia', async () => {
  await resetCash();
  await openRegister({ openingAmount: 8000, operator: 'teste' });
  const referenceId = new mongoose.Types.ObjectId();
  await registerLedgerMovement({
    type: 'venda',
    method: 'dinheiro',
    amount: 3000,
    referenceId,
  });
  const closed = await closeRegister({ countedCash: 11000 });
  assert.equal(closed.summary.byMethod.dinheiro, 3000);
  assert.equal(closed.expectedCash, 11000);

  await openRegister({ openingAmount: 0, operator: 'teste' });
  await reverseLedgerForReference(referenceId);

  const morning = await CashRegister.findById(closed._id);
  const morningMine = movementsFor(morning, referenceId);
  assert.equal(morning.status, 'fechado');
  assert.equal(morningMine.filter((movement) => movement.type === 'venda').length, 1);
  assert.equal(morningMine.filter((movement) => movement.type === 'estorno').length, 0);
  assert.equal(summarizeRegister(morning).byMethod.dinheiro, 3000);

  const afternoon = await CashRegister.findOne({ status: 'aberto' });
  const afternoonMine = movementsFor(afternoon, referenceId);
  assert.equal(afternoonMine.length, 1);
  assert.equal(afternoonMine[0].type, 'estorno');
  assert.equal(afternoonMine[0].method, 'dinheiro');
  assert.equal(afternoonMine[0].amount, 3000);
  assert.equal(summarizeRegister(afternoon).byMethod.dinheiro, -3000);
  assert.equal(afternoon.expectedCash, -3000);

  await reverseLedgerForReference(referenceId);
  const again = await CashRegister.findOne({ status: 'aberto' });
  assert.equal(movementsFor(again, referenceId).filter((movement) => movement.type === 'estorno').length, 1);
});

test('sem caixa aberto o estorno continua recusado', async () => {
  await resetCash();
  await assert.rejects(
    () => reverseLedgerForReference(new mongoose.Types.ObjectId()),
    (error) => error.status === 409 && error.message === CASH_CLOSED_MESSAGE,
  );
});

test('cancelar venda após fechar o caixa estorna no novo aberto e devolve estoque', async () => {
  await resetCash();
  await openRegister({ openingAmount: 0, operator: 'teste' });
  const product = await makeProduct();
  const sale = await createSale({
    items: [{ product: product._id, quantity: 1 }],
    payments: [{ method: 'pix', amount: 2000 }],
    operator: 'teste',
  });
  const closed = await closeRegister({ countedCash: 0 });

  await openRegister({ openingAmount: 0, operator: 'teste' });
  const cancelled = await cancelSale(sale._id, { operator: 'teste' });
  assert.equal(cancelled.status, 'cancelada');
  assert.equal((await Product.findById(product._id)).currentStock, 10);

  const morning = await CashRegister.findById(closed._id);
  assert.equal(movementsFor(morning, sale._id).filter((movement) => movement.type === 'estorno').length, 0);
  assert.equal(summarizeRegister(morning).byMethod.pix, 2000);

  const afternoon = await CashRegister.findOne({ status: 'aberto' });
  const reversal = movementsFor(afternoon, sale._id).find((movement) => movement.type === 'estorno');
  assert.equal(reversal.amount, 2000);
  assert.equal(reversal.method, 'pix');
});

test('cancelar OS paga após fechar o caixa estorna no novo aberto', async () => {
  await resetCash();
  await openRegister({ openingAmount: 0, operator: 'teste' });
  const product = await makeProduct();
  const customer = await Customer.create({ name: 'A10 OS', phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const created = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'A10',
  });
  await addPartToWorkOrder(created._id, { productId: product._id, quantity: 1 });
  await addPaymentToWorkOrder(created._id, { method: 'pix', amount: 2000 });
  const closed = await closeRegister({ countedCash: 0 });

  await openRegister({ openingAmount: 0, operator: 'teste' });
  const cancelled = await cancelWorkOrder(created._id, 'teste');
  assert.equal(cancelled.status, 'cancelada');

  const morning = await CashRegister.findById(closed._id);
  assert.equal(movementsFor(morning, created._id).filter((movement) => movement.type === 'os').length, 1);
  assert.equal(movementsFor(morning, created._id).filter((movement) => movement.type === 'estorno').length, 0);

  const afternoon = await CashRegister.findOne({ status: 'aberto' });
  const reversal = movementsFor(afternoon, created._id).find((movement) => movement.type === 'estorno');
  assert.equal(reversal.amount, 2000);
  assert.equal(reversal.method, 'pix');
});
