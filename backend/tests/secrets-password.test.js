import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskSecret, toPublicSettings } from '../src/routes/settings.js';
import { toPublicPayment, toPublicFiscal } from '../src/utils/publicDto.js';
import { hashPassword, PASSWORD_TOO_SHORT_MESSAGE } from '../src/services/userService.js';

test('maskSecret não revela pedaços do token', () => {
  assert.equal(maskSecret(''), '');
  assert.equal(maskSecret('APP_USR-segredo-bem-longo-1234'), '••••••••');
  assert.equal(maskSecret('curto'), '••••••••');
  assert.equal(maskSecret('APP_USR-segredo-bem-longo-1234').includes('APP_'), false);
});

test('DTO de settings não devolve tokens', () => {
  const settings = {
    storeName: 'BikeGer',
    mpAccessToken: 'APP_USR-secreto',
    focusNfeToken: 'focus-secreto',
    whatsappToken: 'wa-secreto',
    fiscalCscToken: 'csc-secreto',
    fiscalCscId: '000001',
    mpPublicKey: 'APP_PUB',
    toObject() {
      return {
        storeName: this.storeName,
        mpAccessToken: this.mpAccessToken,
        focusNfeToken: this.focusNfeToken,
        whatsappToken: this.whatsappToken,
        fiscalCscToken: this.fiscalCscToken,
        fiscalCscId: this.fiscalCscId,
        mpPublicKey: this.mpPublicKey,
      };
    },
  };
  const publicSettings = toPublicSettings(settings);
  assert.equal(publicSettings.mpAccessToken, undefined);
  assert.equal(publicSettings.focusNfeToken, undefined);
  assert.equal(publicSettings.whatsappToken, undefined);
  assert.equal(publicSettings.fiscalCscToken, undefined);
  assert.equal(publicSettings.hasCsc, true);
});

test('DTO de payment e fiscal não devolve raw', () => {
  const payment = toPublicPayment({
    _id: 'p1',
    status: 'pending',
    amount: 1000,
    relatedType: 'sale',
    relatedId: 's1',
    qrCode: '000201',
    raw: { access_token: 'nao-vazar' },
  });
  assert.equal(payment.qrCode, '000201');
  assert.equal(payment.raw, undefined);

  const fiscal = toPublicFiscal({
    _id: 'f1',
    status: 'pendente',
    amount: 1000,
    relatedType: 'sale',
    relatedId: 's1',
    raw: { token: 'focus-secreto' },
  });
  assert.equal(fiscal.raw, undefined);
  assert.equal(fiscal.status, 'pendente');
});

test('senha nova precisa de 8 caracteres; demo do seed ainda pode ter 7', async () => {
  await assert.rejects(() => hashPassword('bikeger'), (error) => error.message === PASSWORD_TOO_SHORT_MESSAGE);
  const hash = await hashPassword('bikeger', { allowDemo: true });
  assert.equal(typeof hash, 'string');
  assert.ok(hash.length > 20);
});
