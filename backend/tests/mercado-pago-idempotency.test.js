import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Payment } from '../src/models/Payment.js';
import { Sale } from '../src/models/Sale.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import {
  applyApprovedPayment,
  createCheckoutPreference,
  createPixPayment,
  findOpenCharge,
  syncPaymentStatus,
} from '../src/services/mercadoPagoService.js';
import { ensureOpenRegister } from './helpers/openCash.js';

const uri = process.env.MONGODB_TEST_URI_C2 || 'mongodb://127.0.0.1:27017/bikeger_test_c2';

before(async () => {
  await mongoose.connect(uri);
  await Payment.syncIndexes();
  await Payment.deleteMany({});
  await ensureOpenRegister();
});

after(async () => {
  await mongoose.disconnect();
});

function oid() {
  return new mongoose.Types.ObjectId();
}

async function fakePixRemote({ id = `mp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}` } = {}) {
  let calls = 0;
  return {
    calls: () => calls,
    run: async () => {
      calls += 1;
      return {
        id,
        status: 'pending',
        point_of_interaction: {
          transaction_data: {
            qr_code: `pix-${id}`,
            qr_code_base64: 'abc',
            ticket_url: `https://mp/${id}`,
          },
        },
      };
    },
  };
}

test('segundo PIX da mesma OS reutiliza a cobrança pendente e não chama o Mercado Pago de novo', async () => {
  const relatedId = oid();
  const remote = await fakePixRemote();
  const first = await createPixPayment({
    relatedType: 'workOrder',
    relatedId,
    title: 'OS teste',
    amount: 8000,
    chargeRemote: remote.run,
  });
  assert.match(first.qrCode, /^pix-mp-/);
  assert.equal(remote.calls(), 1);

  const second = await createPixPayment({
    relatedType: 'workOrder',
    relatedId,
    title: 'OS teste',
    amount: 8000,
    chargeRemote: remote.run,
  });
  assert.equal(String(second._id), String(first._id));
  assert.equal(second.qrCode, first.qrCode);
  assert.equal(remote.calls(), 1);

  const open = await findOpenCharge('workOrder', relatedId);
  assert.equal(String(open._id), String(first._id));
});

test('cobrança pendente com valor diferente é recusada com 409', async () => {
  const relatedId = oid();
  await Payment.create({
    provider: 'mercado_pago',
    status: 'pending',
    amount: 5000,
    relatedType: 'sale',
    relatedId,
    qrCode: 'pix-old',
  });

  await assert.rejects(
    () =>
      createPixPayment({
        relatedType: 'sale',
        relatedId,
        title: 'Venda',
        amount: 9000,
        chargeRemote: async () => {
          throw new Error('não deveria chamar o Mercado Pago');
        },
      }),
    /já existe uma cobrança/i,
  );
});

test('índice único impede dois pendentes para o mesmo documento', async () => {
  const relatedId = oid();
  await Payment.create({
    relatedType: 'sale',
    relatedId,
    status: 'pending',
    amount: 1000,
    ticketUrl: 'https://mp/pref',
    preferenceId: 'pref-1',
  });
  await assert.rejects(
    () =>
      Payment.create({
        relatedType: 'sale',
        relatedId,
        status: 'pending',
        amount: 1000,
      }),
    (error) => error.code === 11000,
  );
});

test('webhook repetido do mesmo paymentId não duplica paidAmount nem o livro', async () => {
  const number = `VD-C2-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const sale = await Sale.create({
    number,
    items: [],
    subtotal: 10000,
    discount: 0,
    total: 10000,
    paidAmount: 0,
    status: 'aberta',
    payments: [],
  });
  const payment = await Payment.create({
    relatedType: 'sale',
    relatedId: sale._id,
    status: 'approved',
    amount: 10000,
    paymentId: `mp-dup-${sale._id}`,
  });

  const remote = { id: payment.paymentId, status: 'approved' };
  await applyApprovedPayment(payment, remote);
  await applyApprovedPayment(payment, remote);

  const after = await Sale.findById(sale._id);
  assert.equal(after.payments.length, 1);
  assert.equal(after.paidAmount, 10000);
  assert.equal(after.status, 'paga');
});

test('segundo paymentId aprovado é ignorado se a venda já está coberta', async () => {
  const number = `VD-C2B-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const sale = await Sale.create({
    number,
    items: [],
    subtotal: 4000,
    discount: 0,
    total: 4000,
    paidAmount: 0,
    status: 'aberta',
    payments: [],
  });

  await applyApprovedPayment(
    { relatedType: 'sale', relatedId: sale._id, amount: 4000 },
    { id: 'mp-a' },
  );
  await applyApprovedPayment(
    { relatedType: 'sale', relatedId: sale._id, amount: 4000 },
    { id: 'mp-b' },
  );

  const after = await Sale.findById(sale._id);
  assert.equal(after.payments.length, 1);
  assert.equal(after.payments[0].mercadoPagoId, 'mp-a');
  assert.equal(after.paidAmount, 4000);
});

test('sync do webhook anexa o paymentId ao slot pendente em vez de criar outro', async () => {
  const relatedId = oid();
  const slot = await Payment.create({
    relatedType: 'workOrder',
    relatedId,
    status: 'pending',
    amount: 2500,
    preferenceId: 'pref-sync',
    ticketUrl: 'https://mp/pref-sync',
  });

  const synced = await syncPaymentStatus(`mp-sync-${relatedId}`, {
    fetchRemote: async (id) => ({
      id,
      status: 'pending',
      transaction_amount: 25,
      metadata: { relatedType: 'workOrder', relatedId: String(relatedId) },
    }),
  });

  assert.equal(String(synced._id), String(slot._id));
  assert.equal(synced.paymentId, `mp-sync-${relatedId}`);
  const count = await Payment.countDocuments({ relatedType: 'workOrder', relatedId });
  assert.equal(count, 1);
});

test('preferência reutiliza init_point da cobrança aberta', async () => {
  const relatedId = oid();
  let calls = 0;
  const chargeRemote = async () => {
    calls += 1;
    return { id: 'pref-1', init_point: 'https://mp/init', sandbox_init_point: 'https://mp/sandbox' };
  };

  const first = await createCheckoutPreference({
    relatedType: 'sale',
    relatedId,
    title: 'Venda',
    amount: 1500,
    chargeRemote,
  });
  const second = await createCheckoutPreference({
    relatedType: 'sale',
    relatedId,
    title: 'Venda',
    amount: 1500,
    chargeRemote,
  });

  assert.equal(calls, 1);
  assert.equal(first.initPoint, 'https://mp/init');
  assert.equal(second.initPoint, first.initPoint);
  assert.equal(String(second.payment._id), String(first.payment._id));
});

test('aprovação MP na OS não aplica o mesmo id duas vezes', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const customer = await Customer.create({ name: `C2 ${suffix}`, phone: '11' });
  const bike = await Bike.create({
    customer: customer._id,
    brand: 'Caloi',
    model: '10',
    type: 'urbana',
  });
  const order = await WorkOrder.create({
    number: `OS-C2-${suffix}`,
    customer: customer._id,
    bike: bike._id,
    status: 'pronta',
    total: 3000,
    paidAmount: 0,
    laborTotal: 3000,
    partsTotal: 0,
    discount: 0,
    payments: [],
  });

  const payment = { relatedType: 'workOrder', relatedId: order._id, amount: 3000 };
  await applyApprovedPayment(payment, { id: 'mp-os-1' });
  await applyApprovedPayment(payment, { id: 'mp-os-1' });

  const after = await WorkOrder.findById(order._id);
  assert.equal(after.payments.length, 1);
  assert.equal(after.paidAmount, 3000);
});
