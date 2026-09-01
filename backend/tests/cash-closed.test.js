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
import {
  CASH_CLOSED_MESSAGE,
  closeRegister,
  openRegister,
  registerLedgerMovement,
  registerCashMovement,
  reverseLedgerForReference,
} from '../src/services/cashService.js';
import { createSale } from '../src/services/saleService.js';
import { addPartToWorkOrder, addPaymentToWorkOrder, cancelWorkOrder, createWorkOrder } from '../src/services/workOrderService.js';
import { applyApprovedPayment } from '../src/services/mercadoPagoService.js';

const uri = process.env.MONGODB_TEST_URI_C3 || 'mongodb://127.0.0.1:27017/bikeger_test_c3';

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
  ]);
});

after(async () => {
  await mongoose.disconnect();
});

async function closeCash() {
  await CashRegister.updateMany(
    { status: 'aberto' },
    { $set: { status: 'fechado', closedAt: new Date() } },
  );
}

async function makeProduct() {
  const sku = `C3-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
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

test('registerLedgerMovement recusa caixa fechado e não grava movimento', async () => {
  await closeCash();
  await assert.rejects(
    () =>
      registerLedgerMovement({
        type: 'venda',
        method: 'pix',
        amount: 1000,
        notes: 'não deveria entrar',
      }),
    (error) => error.status === 409 && error.message === CASH_CLOSED_MESSAGE,
  );
  assert.equal(await CashRegister.countDocuments({ status: 'aberto' }), 0);
});

test('venda com caixa fechado não baixa estoque nem cria venda paga', async () => {
  await closeCash();
  const product = await makeProduct();

  await assert.rejects(
    () =>
      createSale({
        items: [{ product: product._id, quantity: 2 }],
        payments: [{ method: 'pix', amount: 4000 }],
        operator: 'teste',
      }),
    /nenhum caixa aberto/i,
  );

  assert.equal((await Product.findById(product._id)).currentStock, 10);
  assert.equal(await Sale.countDocuments({ status: 'paga' }), 0);
});

test('venda com caixa aberto entra no livro do dia', async () => {
  await closeCash();
  await openRegister({ openingAmount: 5000, operator: 'teste' });
  const product = await makeProduct();

  const sale = await createSale({
    items: [{ product: product._id, quantity: 1 }],
    payments: [{ method: 'dinheiro', amount: 2000 }],
    operator: 'teste',
  });

  assert.equal(sale.status, 'paga');
  const register = await CashRegister.findOne({ status: 'aberto' });
  const mine = register.movements.filter((movement) => String(movement.referenceId) === String(sale._id));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].type, 'venda');
  assert.equal(mine[0].amount, 2000);
  assert.equal(mine[0].method, 'dinheiro');
});

test('pagamento da OS com caixa fechado não altera paidAmount', async () => {
  await closeCash();
  const customer = await Customer.create({ name: 'C3 OS', phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const order = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'C3',
  });

  await assert.rejects(
    () =>
      addPaymentToWorkOrder(order._id, {
        method: 'pix',
        amount: 1500,
      }),
    /nenhum caixa aberto/i,
  );

  const after = await WorkOrder.findById(order._id);
  assert.equal(after.payments.length, 0);
  assert.equal(after.paidAmount, 0);
});

test('webhook MP com caixa fechado não marca a venda como paga', async () => {
  await closeCash();
  const sale = await Sale.create({
    number: `VD-C3-${Date.now()}`,
    items: [],
    subtotal: 3000,
    discount: 0,
    total: 3000,
    paidAmount: 0,
    status: 'aberta',
    payments: [],
  });

  await assert.rejects(
    () =>
      applyApprovedPayment(
        { relatedType: 'sale', relatedId: sale._id, amount: 3000 },
        { id: `mp-c3-${sale._id}` },
      ),
    /nenhum caixa aberto/i,
  );

  const after = await Sale.findById(sale._id);
  assert.equal(after.paidAmount, 0);
  assert.equal(after.payments.length, 0);
  assert.equal(after.status, 'aberta');
});

test('sangria e estorno também exigem caixa aberto', async () => {
  await closeCash();
  await assert.rejects(
    () => registerCashMovement({ type: 'sangria', amount: 100, notes: 'teste' }),
    /nenhum caixa aberto/i,
  );
  await assert.rejects(
    () => reverseLedgerForReference(new mongoose.Types.ObjectId()),
    /nenhum caixa aberto/i,
  );
});

test('depois de fechar o caixa, nova venda volta a ser recusada', async () => {
  await closeCash();
  await openRegister({ openingAmount: 0, operator: 'teste' });
  await closeRegister({ countedCash: 0 });
  const product = await makeProduct();

  await assert.rejects(
    () =>
      createSale({
        items: [{ product: product._id, quantity: 1 }],
        payments: [{ method: 'pix', amount: 2000 }],
      }),
    /nenhum caixa aberto/i,
  );
  assert.equal((await Product.findById(product._id)).currentStock, 10);
});

test('OS paga não cancela com caixa fechado: status, pagamento e estoque ficam', async () => {
  await closeCash();
  await openRegister({ openingAmount: 0, operator: 'teste' });
  const product = await makeProduct();
  const customer = await Customer.create({ name: 'A2 OS', phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const created = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'A2',
  });
  await addPartToWorkOrder(created._id, { productId: product._id, quantity: 2 });
  await addPaymentToWorkOrder(created._id, { method: 'pix', amount: 4000 });
  await closeRegister({ countedCash: 0 });

  await assert.rejects(() => cancelWorkOrder(created._id, 'teste'), /nenhum caixa aberto/i);

  const after = await WorkOrder.findById(created._id);
  assert.notEqual(after.status, 'cancelada');
  assert.equal(after.payments.length, 1);
  assert.equal(after.paidAmount, 4000);
  assert.equal((await Product.findById(product._id)).reservedStock, 2);
  assert.equal((await Product.findById(product._id)).currentStock, 10);
});

