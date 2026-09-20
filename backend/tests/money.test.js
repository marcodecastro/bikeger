import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCents,
  assertCents,
  formatBRL,
  multiplyCents,
  parseBRLToCents,
  subtractCents,
  centsToMpAmount,
  mpAmountToCents,
  weightedAverageCost,
} from '../src/utils/money.js';

test('0.1 + 0.2 em centavos dá 30', () => {
  assert.equal(addCents(10, 20), 30);
  assert.equal(formatBRL(30), 'R$ 0,30');
});

test('preços de catálogo', () => {
  assert.equal(formatBRL(15990), 'R$ 159,90');
  assert.equal(formatBRL(24990), 'R$ 249,90');
  assert.equal(parseBRLToCents('159,90'), 15990);
  assert.equal(parseBRLToCents('1.234,56'), 123456);
});

test('recusa decimal interno', () => {
  assert.throws(() => assertCents(0.1, 'teste'), /inteiro em centavos/);
  assert.throws(() => addCents(10, 0.2), /inteiro em centavos/);
});

test('quantidade vezes preço unitário', () => {
  assert.equal(multiplyCents(4990, 3), 14970);
  assert.equal(subtractCents(5000, 4990), 10);
});

test('borda Mercado Pago ida e volta', () => {
  assert.equal(centsToMpAmount(24990), 249.9);
  assert.equal(mpAmountToCents(249.9), 24990);
  assert.equal(mpAmountToCents(centsToMpAmount(11970)), 11970);
});

test('custo médio da compra em centavos', () => {
  assert.equal(weightedAverageCost(0, 0, 10, 1500), 1500);
  assert.equal(weightedAverageCost(10, 1000, 10, 2000), 1500);
  assert.equal(weightedAverageCost(1, 1000, 1, 1001), 1001);
});
