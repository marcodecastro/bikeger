import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex, searchRegex } from '../src/utils/searchRegex.js';

test('busca trata metacaracteres como texto, não como regex', () => {
  const rx = searchRegex('(a+)+$');
  assert.ok(rx);
  assert.equal(rx.source, escapeRegex('(a+)+$'));
  assert.equal(rx.test('(a+)+$'), true);
  assert.equal(rx.test('aaaaaaaaaaaaaaaaaaaa'), false);
});

test('busca continua case-insensitive no nome da peça', () => {
  const rx = searchRegex('corrente');
  assert.equal(rx.test('Corrente SRAM'), true);
  assert.equal(rx.test('cabo'), false);
});

test('ponto no aro não vira curinga', () => {
  const rx = searchRegex('27.5');
  assert.equal(rx.test('Aro 27.5'), true);
  assert.equal(rx.test('Aro 275'), false);
});

test('query vazia ou só espaço não vira regex', () => {
  assert.equal(searchRegex(''), null);
  assert.equal(searchRegex('   '), null);
});
