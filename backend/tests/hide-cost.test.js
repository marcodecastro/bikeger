import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hideCostIfNeeded } from '../src/utils/hideCost.js';

const payload = {
  products: [{ name: 'Corrente', costPrice: 1000, salePrice: 2000 }],
  orders: [{ parts: [{ name: 'Cabo', unitCost: 500, unitPrice: 900, total: 900 }] }],
  movements: [{ unitCost: 1000, unitPrice: 2000, quantity: 1 }],
  sales: [{ items: [{ unitCost: 800, unitPrice: 1590, total: 1590 }] }],
};

test('mecânico não recebe costPrice nem unitCost aninhado', () => {
  const stripped = hideCostIfNeeded(payload, { role: 'mecanico' });
  assert.equal(stripped.products[0].costPrice, undefined);
  assert.equal(stripped.products[0].salePrice, 2000);
  assert.equal(stripped.orders[0].parts[0].unitCost, undefined);
  assert.equal(stripped.orders[0].parts[0].unitPrice, 900);
  assert.equal(stripped.movements[0].unitCost, undefined);
  assert.equal(stripped.movements[0].unitPrice, 2000);
  assert.equal(stripped.sales[0].items[0].unitCost, undefined);
  assert.equal(stripped.sales[0].items[0].unitPrice, 1590);
});

test('balcão com sales continua vendo custo', () => {
  const kept = hideCostIfNeeded({ costPrice: 1000, unitCost: 400 }, { role: 'balcao' });
  assert.equal(kept.costPrice, 1000);
  assert.equal(kept.unitCost, 400);
});

test('dono vê custo', () => {
  const kept = hideCostIfNeeded({ costPrice: 1000 }, { role: 'dono' });
  assert.equal(kept.costPrice, 1000);
});

test('documento com toJSON perde custo para o mecânico e preserva venda', () => {
  const doc = {
    costPrice: 1000,
    salePrice: 2000,
    toJSON() {
      return { costPrice: 1000, salePrice: 2000 };
    },
  };
  const stripped = hideCostIfNeeded(doc, { role: 'mecanico' });
  assert.equal(stripped.costPrice, undefined);
  assert.equal(stripped.salePrice, 2000);
});
