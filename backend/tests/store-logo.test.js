import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStoreLogo,
  STORE_LOGO_INVALID_MESSAGE,
  STORE_LOGO_TOO_BIG_MESSAGE,
} from '../src/utils/storeLogo.js';

test('logo vazia é aceita', () => {
  assert.equal(normalizeStoreLogo(''), '');
  assert.equal(normalizeStoreLogo('   '), '');
});

test('logo https e data URL PNG passam', () => {
  assert.equal(normalizeStoreLogo('https://loja.example/logo.png'), 'https://loja.example/logo.png');
  const data = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(normalizeStoreLogo(data), data);
});

test('logo recusa javascript e http', () => {
  assert.throws(() => normalizeStoreLogo('javascript:alert(1)'), (error) => error.message === STORE_LOGO_INVALID_MESSAGE);
  assert.throws(() => normalizeStoreLogo('http://loja.example/logo.png'), (error) => error.message === STORE_LOGO_INVALID_MESSAGE);
});

test('logo recusa arquivo enorme', () => {
  const huge = `data:image/png;base64,${'A'.repeat(360_000)}`;
  assert.throws(() => normalizeStoreLogo(huge), (error) => error.message === STORE_LOGO_TOO_BIG_MESSAGE);
});
