import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Settings } from '../src/models/Settings.js';
import { buildReceipt, buildDayReportReceipt } from '../src/services/printerService.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bikeger_test';

before(async () => {
  await mongoose.connect(uri);
  await Settings.findOneAndUpdate(
    {},
    {
      storeName: 'Oficina Teste',
      storeAddress: 'Rua da Oficina, 120',
      storePhone: '(11) 99999-0000',
      storeCnpj: '00.000.000/0001-00',
      receiptFooter: 'Obrigado pela preferência.',
      printerWidth: 80,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

test('cupom não fiscal alinha valores e fecha com o nome da loja', async () => {
  const receipt = await buildReceipt({
    kind: 'sale',
    number: 'VD-00007',
    customerName: '',
    items: [
      { quantity: 1, name: 'Cabo de cambio inox', unitPrice: 1990, total: 1990 },
      { quantity: 1, name: 'Instalacao de cambio', unitPrice: 5000, total: 5000 },
    ],
    totals: { subtotal: 6990, discount: 0, total: 6990, laborTotal: 5000, partsTotal: 1990 },
    payments: [{ method: 'dinheiro', amount: 6990 }],
  });

  assert.match(receipt.text, /CUPOM NAO FISCAL VD-00007/);
  assert.match(receipt.text, /Consumidor/);
  assert.match(receipt.text, /Dinheiro/);
  assert.doesNotMatch(receipt.text, /notemaster/i);
  assert.doesNotMatch(receipt.text, /loja \+ oficina/);
  assert.match(receipt.text, /^Oficina Teste$/m);
  assert.match(receipt.text, /Cuidamos da sua bike para você focar/);
  assert.match(receipt.text, /apenas no caminho\./);
  const thankYouLine = 'Obrigado pela preferência!';
  const thankYou = receipt.text.split('\n').find((row) => row.includes(thankYouLine));
  assert.equal(thankYou, `${' '.repeat(Math.floor((42 - thankYouLine.length) / 2))}${thankYouLine}`);
  const footerGap = receipt.text.match(
    /Obrigado pela preferência\.\n\n\nCuidamos da sua bike para você focar/,
  );
  assert.ok(footerGap, 'falta espaçamento entre rodapé padrão e mensagem da oficina');

  const moneyLines = receipt.text.split('\n').filter((row) => /R\$/.test(row));
  for (const row of moneyLines) {
    assert.ok(!/R\$\s+\d/.test(row) || /R\$\u00a0/.test(row), `valor quebrável: ${row}`);
    assert.ok(row.length <= 42, `linha larga demais (${row.length}): ${row}`);
  }
  assert.equal(receipt.columns, 42);
});

test('relatório do dia também não cita notemaster', async () => {
  const receipt = await buildDayReportReceipt({
    openingAmount: 0,
    countedCash: 0,
    expectedCash: 0,
    difference: 0,
    byMethod: { dinheiro: 0, pix: 0 },
    sangria: 0,
    suprimento: 0,
    osCount: 0,
    osTotal: 0,
    fiscalEnabled: false,
  });
  assert.doesNotMatch(receipt.text, /notemaster/i);
  assert.match(receipt.text, /Oficina Teste/);
  assert.match(receipt.text, /fechamento do dia/);
});
