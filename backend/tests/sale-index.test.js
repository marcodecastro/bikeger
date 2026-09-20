import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sale } from '../src/models/Sale.js';

test('Sale tem índice de status + data para painel, lista e margem', () => {
  const indexes = Sale.schema.indexes();
  assert.ok(
    indexes.some(([fields]) => fields.status === 1 && fields.createdAt === -1),
    JSON.stringify(indexes),
  );
});
