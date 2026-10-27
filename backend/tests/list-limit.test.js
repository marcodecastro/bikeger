import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listLimit, listSkip, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, MAX_LIST_SKIP } from '../src/utils/listLimit.js';

test('listLimit usa o padrão e recusa pedido enorme', () => {
  assert.equal(listLimit(undefined), DEFAULT_LIST_LIMIT);
  assert.equal(listLimit('80', 80), 80);
  assert.equal(listLimit(99999), MAX_LIST_LIMIT);
  assert.equal(listLimit(-1, 50), 50);
  assert.equal(listLimit('abc', 40), 40);
});

test('listSkip começa em zero e recusa salto enorme', () => {
  assert.equal(listSkip(undefined), 0);
  assert.equal(listSkip('50'), 50);
  assert.equal(listSkip(-1), 0);
  assert.equal(listSkip('abc'), 0);
  assert.equal(listSkip(999999), MAX_LIST_SKIP);
});
