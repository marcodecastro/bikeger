import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listLimit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '../src/utils/listLimit.js';

test('listLimit usa o padrão e recusa pedido enorme', () => {
  assert.equal(listLimit(undefined), DEFAULT_LIST_LIMIT);
  assert.equal(listLimit('80', 80), 80);
  assert.equal(listLimit(99999), MAX_LIST_LIMIT);
  assert.equal(listLimit(-1, 50), 50);
  assert.equal(listLimit('abc', 40), 40);
});
