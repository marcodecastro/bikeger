import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { CashRegister } from '../src/models/CashRegister.js';
import {
  ALREADY_OPEN_MESSAGE,
  closeRegister,
  getOpenRegister,
  openRegister,
} from '../src/services/cashService.js';

const uri = process.env.MONGODB_TEST_URI_A5 || 'mongodb://127.0.0.1:27017/bikeger_test_a5';

before(async () => {
  await mongoose.connect(uri);
  await CashRegister.syncIndexes();
  await CashRegister.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
});

test('índice único impede dois caixas abertos', async () => {
  await CashRegister.create({ openingAmount: 0, operator: 'a', expectedCash: 0, status: 'aberto' });
  await assert.rejects(
    () => CashRegister.create({ openingAmount: 100, operator: 'b', expectedCash: 100, status: 'aberto' }),
    (error) => error.code === 11000,
  );
  await CashRegister.deleteMany({});
});

test('segunda abertura sequencial é recusada com 409', async () => {
  await CashRegister.deleteMany({});
  const first = await openRegister({ openingAmount: 2500, operator: 'marco' });
  assert.equal(first.status, 'aberto');
  assert.equal(first.openingAmount, 2500);

  await assert.rejects(() => openRegister({ openingAmount: 1000, operator: 'leo' }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.message, ALREADY_OPEN_MESSAGE);
    return true;
  });

  assert.equal(await CashRegister.countDocuments({ status: 'aberto' }), 1);
});

test('duas aberturas em paralelo deixam um único caixa aberto', async () => {
  await CashRegister.deleteMany({});
  const results = await Promise.allSettled([
    openRegister({ openingAmount: 1000, operator: 'a' }),
    openRegister({ openingAmount: 2000, operator: 'b' }),
  ]);

  const ok = results.filter((result) => result.status === 'fulfilled');
  const denied = results.filter((result) => result.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(denied.length, 1);
  assert.equal(denied[0].reason.status, 409);
  assert.equal(denied[0].reason.message, ALREADY_OPEN_MESSAGE);
  assert.equal(await CashRegister.countDocuments({ status: 'aberto' }), 1);
  assert.equal(String((await getOpenRegister())._id), String(ok[0].value._id));
});

test('depois de fechar, o caixa pode abrir de novo', async () => {
  await CashRegister.deleteMany({});
  await openRegister({ openingAmount: 0, operator: 'teste' });
  await closeRegister({ countedCash: 0 });
  const again = await openRegister({ openingAmount: 5000, operator: 'teste' });
  assert.equal(again.status, 'aberto');
  assert.equal(again.openingAmount, 5000);
  assert.equal(await CashRegister.countDocuments({ status: 'aberto' }), 1);
  assert.equal(await CashRegister.countDocuments({ status: 'fechado' }), 1);
});
