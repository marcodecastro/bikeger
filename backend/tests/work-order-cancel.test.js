import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { CashRegister } from '../src/models/CashRegister.js';
import {
  addPartToWorkOrder,
  addPaymentToWorkOrder,
  cancelWorkOrder,
  consumePartOnWorkOrder,
  createWorkOrder,
  persistWorkOrder,
  updateWorkOrder,
  WORK_ORDER_CONFLICT_MESSAGE,
  WORK_ORDER_DISCOUNT_FORBIDDEN,
  WORK_ORDER_PAID_CANCEL_FORBIDDEN,
  WORK_ORDER_PART_PRICE_FORBIDDEN,
} from '../src/services/workOrderService.js';
import { ensureOpenRegister } from './helpers/openCash.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

async function makeOrder(sku, stock) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const product = await Product.create({
    sku: `${sku}-${suffix}`,
    barcode: `${sku}-${suffix}`,
    name: `Peça ${sku}`,
    category: 'Teste',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: stock,
    minStock: 0,
    unit: 'UN',
  });
  const customer = await Customer.create({ name: `Cliente C1 ${suffix}`, phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const order = await createWorkOrder({
    customer: customer._id,
    bike: bike._id,
    complaint: 'teste cancelamento C1',
  });
  return { product, order };
}

test('PATCH status=cancelada libera peça reservada sem mexer no estoque físico', async () => {
  const { product, order } = await makeOrder('C1-RES', 5);
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 2 });

  let stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 5);
  assert.equal(stock.reservedStock, 2);

  const cancelled = await updateWorkOrder(order._id, { status: 'cancelada' }, 'teste');
  assert.equal(cancelled.status, 'cancelada');

  stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 5);
  assert.equal(stock.reservedStock, 0);

  const releases = await StockMovement.find({
    referenceId: order._id,
    type: 'reserva_liberada',
  });
  assert.equal(releases.length, 1);
  assert.equal(releases[0].quantity, 2);
});

test('PATCH status=cancelada devolve peça já consumida ao estoque físico', async () => {
  const { product, order } = await makeOrder('C1-CON', 5);
  const withPart = await addPartToWorkOrder(order._id, { productId: product._id, quantity: 2 });
  await consumePartOnWorkOrder(order._id, withPart.parts[0]._id);

  let stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 3);
  assert.equal(stock.reservedStock, 0);

  const cancelled = await updateWorkOrder(order._id, { status: 'cancelada' }, 'teste');
  assert.equal(cancelled.status, 'cancelada');

  stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 5);
  assert.equal(stock.reservedStock, 0);

  const returns = await StockMovement.find({
    referenceId: order._id,
    type: 'os_estorno',
  });
  assert.equal(returns.length, 1);
  assert.equal(returns[0].quantity, 2);
});

test('cancelamento misto libera reserva e estorna consumo', async () => {
  const { product, order } = await makeOrder('C1-MIX', 6);
  const first = await addPartToWorkOrder(order._id, { productId: product._id, quantity: 2 });
  await consumePartOnWorkOrder(order._id, first.parts[0]._id);
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 });

  let stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 4);
  assert.equal(stock.reservedStock, 1);

  await cancelWorkOrder(order._id, 'teste');

  stock = await Product.findById(product._id);
  assert.equal(stock.currentStock, 6);
  assert.equal(stock.reservedStock, 0);
});

test('OS entregue não pode ser cancelada nem por PATCH nem pelo endpoint', async () => {
  const { order } = await makeOrder('C1-ENT', 1);
  await WorkOrder.findByIdAndUpdate(order._id, { status: 'entregue', paidAmount: 0, total: 0 });

  await assert.rejects(() => cancelWorkOrder(order._id), /OS entregue não pode ser cancelada/);
  await assert.rejects(
    () => updateWorkOrder(order._id, { status: 'cancelada' }),
    /OS entregue não pode ser cancelada/,
  );
});

test('cancelar de novo a mesma OS é idempotente e não mexe no estoque', async () => {
  const { product, order } = await makeOrder('C1-IDEM', 4);
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 });
  await updateWorkOrder(order._id, { status: 'cancelada' });

  const stockAfterFirst = await Product.findById(product._id);
  const again = await updateWorkOrder(order._id, { status: 'cancelada' });
  assert.equal(again.status, 'cancelada');

  const stockAfterSecond = await Product.findById(product._id);
  assert.equal(stockAfterSecond.currentStock, stockAfterFirst.currentStock);
  assert.equal(stockAfterSecond.reservedStock, 0);

  const releases = await StockMovement.find({
    referenceId: order._id,
    type: 'reserva_liberada',
  });
  assert.equal(releases.length, 1);
});

test('cancelar OS paga lança estorno no livro e não duplica na segunda vez', async () => {
  await ensureOpenRegister();
  const { product, order } = await makeOrder('A2-PIX', 1);
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1, unitPrice: 8000, actor: { role: 'balcao' } });
  await addPaymentToWorkOrder(order._id, { method: 'dinheiro', amount: 8000 });

  const cancelled = await cancelWorkOrder(order._id, 'teste', { role: 'balcao' });
  assert.equal(cancelled.status, 'cancelada');

  const register = await CashRegister.findOne({ status: 'aberto' });
  const mine = register.movements.filter((movement) => String(movement.referenceId) === String(order._id));
  assert.equal(mine.filter((movement) => movement.type === 'os').length, 1);
  assert.equal(mine.filter((movement) => movement.type === 'estorno').length, 1);
  assert.equal(mine.find((movement) => movement.type === 'estorno').amount, 8000);
  assert.equal(mine.find((movement) => movement.type === 'estorno').method, 'dinheiro');

  await cancelWorkOrder(order._id, 'teste', { role: 'balcao' });
  const after = await CashRegister.findOne({ status: 'aberto' });
  const again = after.movements.filter((movement) => String(movement.referenceId) === String(order._id));
  assert.equal(again.filter((movement) => movement.type === 'estorno').length, 1);
});

test('PATCH status=cancelada também estorna dinheiro no caixa', async () => {
  await ensureOpenRegister();
  const { product, order } = await makeOrder('A2-PATCH', 1);
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1, unitPrice: 2500, actor: { role: 'balcao' } });
  await addPaymentToWorkOrder(order._id, { method: 'dinheiro', amount: 2500 });

  await updateWorkOrder(order._id, { status: 'cancelada' }, 'teste', { role: 'balcao' });

  const register = await CashRegister.findOne({ status: 'aberto' });
  const mine = register.movements.filter((movement) => String(movement.referenceId) === String(order._id));
  assert.equal(mine.filter((movement) => movement.type === 'os').length, 1);
  const reversal = mine.find((movement) => movement.type === 'estorno');
  assert.equal(reversal.amount, 2500);
  assert.equal(reversal.method, 'dinheiro');
});

test('OS aberta pode pular para pronta e voltar para em serviço', async () => {
  const { order } = await makeOrder('A3-FLOW', 1);
  const ready = await updateWorkOrder(order._id, { status: 'pronta' }, 'teste');
  assert.equal(ready.status, 'pronta');
  assert.ok(ready.readyAt);

  const back = await updateWorkOrder(order._id, { status: 'em_servico' }, 'teste');
  assert.equal(back.status, 'em_servico');
});

test('OS entregue não volta para aberta nem recebe peça', async () => {
  const { product, order } = await makeOrder('A3-ENT', 3);
  await WorkOrder.findByIdAndUpdate(order._id, {
    status: 'entregue',
    paidAmount: 0,
    total: 0,
    deliveredAt: new Date(),
  });

  await assert.rejects(
    () => updateWorkOrder(order._id, { status: 'aberta' }),
    /OS entregue não pode mudar de status/,
  );
  await assert.rejects(
    () => addPartToWorkOrder(order._id, { productId: product._id, quantity: 1 }),
    /OS encerrada/,
  );

  const after = await WorkOrder.findById(order._id);
  assert.equal(after.status, 'entregue');
  assert.equal(after.parts.length, 0);
});

test('OS cancelada não volta para pronta', async () => {
  const { order } = await makeOrder('A3-CAN', 1);
  await cancelWorkOrder(order._id, 'teste');

  await assert.rejects(
    () => updateWorkOrder(order._id, { status: 'pronta' }),
    /OS cancelada não pode mudar de status/,
  );

  const after = await WorkOrder.findById(order._id);
  assert.equal(after.status, 'cancelada');
});

test('OS nova não nasce entregue', async () => {
  const { order } = await makeOrder('A3-NEW', 1);
  await assert.rejects(
    () =>
      createWorkOrder({
        customer: order.customer._id || order.customer,
        bike: order.bike._id || order.bike,
        complaint: 'não',
        status: 'entregue',
      }),
    /não pode nascer encerrada/,
  );
});

test('persist da OS com __v velho devolve 409', async () => {
  const { order } = await makeOrder('VER', 1);
  const stale = await WorkOrder.findById(order._id);
  const fresh = await WorkOrder.findById(order._id);
  fresh.complaint = 'atual';
  await persistWorkOrder(fresh);
  stale.complaint = 'stale';
  await assert.rejects(
    () => persistWorkOrder(stale),
    (error) => error.status === 409 && error.message === WORK_ORDER_CONFLICT_MESSAGE,
  );
  const after = await WorkOrder.findById(order._id);
  assert.equal(after.complaint, 'atual');
});

test('mecânico não aplica desconto na OS', async () => {
  const { order } = await makeOrder('DISC', 1);
  await assert.rejects(
    () => updateWorkOrder(order._id, { discount: 500 }, 'leo', { role: 'mecanico' }),
    (error) => error.status === 403 && error.message === WORK_ORDER_DISCOUNT_FORBIDDEN,
  );
  const after = await WorkOrder.findById(order._id);
  assert.equal(after.discount, 0);
});

test('mecânico não cancela OS paga', async () => {
  await ensureOpenRegister();
  const { product, order } = await makeOrder('MEC-PAY', 1);
  await addPartToWorkOrder(order._id, { productId: product._id, quantity: 1, unitPrice: 2000 });
  await addPaymentToWorkOrder(order._id, { method: 'dinheiro', amount: 2000 });

  await assert.rejects(
    () => cancelWorkOrder(order._id, 'leo', { role: 'mecanico' }),
    (error) => error.status === 403 && error.message === WORK_ORDER_PAID_CANCEL_FORBIDDEN,
  );
  const after = await WorkOrder.findById(order._id);
  assert.equal(after.status, 'aberta');
  assert.equal(after.paidAmount, 2000);
});

test('mecânico não abre OS com desconto', async () => {
  const { order } = await makeOrder('DISC-NEW', 1);
  await assert.rejects(
    () =>
      createWorkOrder(
        {
          customer: order.customer._id || order.customer,
          bike: order.bike._id || order.bike,
          complaint: 'desconto',
          discount: 500,
        },
        { role: 'mecanico' },
      ),
    (error) => error.status === 403 && error.message === WORK_ORDER_DISCOUNT_FORBIDDEN,
  );
});

test('mecânico não altera o preço da peça; o balcão pode', async () => {
  const { product, order } = await makeOrder('PRICE', 3);
  await assert.rejects(
    () =>
      addPartToWorkOrder(order._id, {
        productId: product._id,
        quantity: 1,
        unitPrice: 1,
        actor: { role: 'mecanico' },
      }),
    (error) => error.status === 403 && error.message === WORK_ORDER_PART_PRICE_FORBIDDEN,
  );

  const catalog = await addPartToWorkOrder(order._id, {
    productId: product._id,
    quantity: 1,
    actor: { role: 'mecanico' },
  });
  assert.equal(catalog.parts[0].unitPrice, 2000);

  const counter = await addPartToWorkOrder(order._id, {
    productId: product._id,
    quantity: 1,
    unitPrice: 1500,
    actor: { role: 'balcao' },
  });
  assert.equal(counter.parts[1].unitPrice, 1500);
});


