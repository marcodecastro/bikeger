import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRegister } from '../src/services/cashService.js';

function register(movements, openingAmount = 10000) {
  return { openingAmount, movements };
}

test('PIX e cartão entram no livro e ficam de fora do gaveteiro', () => {
  const summary = summarizeRegister(
    register([
      { type: 'venda', method: 'dinheiro', amount: 5000 },
      { type: 'venda', method: 'pix', amount: 15990 },
      { type: 'venda', method: 'cartao_credito', amount: 24990 },
    ]),
  );

  assert.equal(summary.expectedCash, 15000);
  assert.equal(summary.byMethod.dinheiro, 5000);
  assert.equal(summary.byMethod.pix, 15990);
  assert.equal(summary.byMethod.cartao_credito, 24990);
  assert.equal(summary.receivedTotal, 45980);
});

test('sangria só mexe no dinheiro físico', () => {
  const summary = summarizeRegister(
    register([
      { type: 'venda', method: 'pix', amount: 10000 },
      { type: 'venda', method: 'dinheiro', amount: 8000 },
      { type: 'sangria', method: 'dinheiro', amount: 3000 },
    ]),
  );

  assert.equal(summary.expectedCash, 15000);
  assert.equal(summary.byMethod.pix, 10000);
  assert.equal(summary.receivedTotal, 18000);
});

test('estorno de PIX zera o livro sem alterar o gaveteiro', () => {
  const summary = summarizeRegister(
    register([
      { type: 'venda', method: 'pix', amount: 6000 },
      { type: 'estorno', method: 'pix', amount: 6000 },
      { type: 'venda', method: 'dinheiro', amount: 2000 },
    ]),
  );

  assert.equal(summary.byMethod.pix, 0);
  assert.equal(summary.expectedCash, 12000);
  assert.equal(summary.receivedTotal, 2000);
});
