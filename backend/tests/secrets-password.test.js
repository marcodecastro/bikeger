import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskSecret } from '../src/routes/settings.js';
import { hashPassword, PASSWORD_TOO_SHORT_MESSAGE } from '../src/services/userService.js';

test('maskSecret não revela pedaços do token', () => {
  assert.equal(maskSecret(''), '');
  assert.equal(maskSecret('APP_USR-segredo-bem-longo-1234'), '••••••••');
  assert.equal(maskSecret('curto'), '••••••••');
  assert.equal(maskSecret('APP_USR-segredo-bem-longo-1234').includes('APP_'), false);
});

test('senha nova precisa de 8 caracteres; demo do seed ainda pode ter 7', async () => {
  await assert.rejects(() => hashPassword('bikeger'), (error) => error.message === PASSWORD_TOO_SHORT_MESSAGE);
  const hash = await hashPassword('bikeger', { allowDemo: true });
  assert.equal(typeof hash, 'string');
  assert.ok(hash.length > 20);
});
