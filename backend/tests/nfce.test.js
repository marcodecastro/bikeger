import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNfcePayload,
  fiscalReadiness,
  focusNfeToken,
  missingEmitenteFields,
  paymentCode,
} from '../src/utils/nfcePayload.js';

const settings = {
  storeName: 'BikeGer',
  storeCnpj: '12.345.678/0001-90',
  stateRegistration: '123456789',
  storeStreet: 'Rua da Oficina',
  storeNumber: '120',
  storeNeighborhood: 'Centro',
  storeCity: 'São Paulo',
  storeState: 'SP',
  storeZip: '01001-000',
  storePhone: '(11) 99999-0000',
  fiscalCscId: '000001',
  fiscalCscToken: 'ABCD1234',
  fiscalSeries: '1',
  fiscalEnvironment: 'homologacao',
  taxRegime: '1',
  defaultNcm: '87149990',
  defaultCfop: '5102',
  defaultIcmsCst: '102',
};

test('cadastro fiscal incompleto lista CSC e endereço', () => {
  const missing = missingEmitenteFields({ storeCnpj: '00', storeState: 'S' });
  assert.ok(missing.includes('CSC ID'));
  assert.ok(missing.includes('CSC token'));
  assert.ok(missing.includes('Logradouro'));
});

test('payload SEFAZ tem item, pagamento e emitente', () => {
  const payload = buildNfcePayload({
    settings,
    customer: { name: 'Ana', document: '12345678901', address: { state: 'SP' } },
    charge: {
      amount: 7990,
      payments: [{ method: 'pix', amount: 7990, status: 'aprovado' }],
      items: [
        {
          sku: 'COR-HG53',
          name: 'Corrente',
          quantity: 1,
          unitPrice: 7990,
          total: 7990,
          unit: 'UN',
          ncm: '87149990',
          cfop: '5102',
        },
      ],
    },
  });

  assert.equal(payload.cnpj_emitente, '12345678000190');
  assert.equal(payload.presenca_comprador, '1');
  assert.equal(payload.modalidade_frete, '9');
  assert.equal(payload.local_destino, '1');
  assert.equal(payload.cpf_destinatario, '12345678901');
  assert.equal(payload.items[0].codigo_ncm, '87149990');
  assert.equal(payload.items[0].cfop, '5102');
  assert.equal(payload.items[0].icms_situacao_tributaria, '102');
  assert.equal(payload.items[0].valor_unitario_comercial, 79.9);
  assert.match(payload.items[0].descricao, /HOMOLOGACAO/);
  assert.equal(payload.formas_pagamento[0].forma_pagamento, '17');
  assert.ok(payload.data_emissao.includes('T'));
});

test('código de pagamento SEFAZ', () => {
  assert.equal(paymentCode('dinheiro'), '01');
  assert.equal(paymentCode('cartao_credito'), '03');
  assert.equal(paymentCode('pix'), '17');
});

test('FOCUS_NFE_TOKEN vem dos Ajustes se o .env estiver vazio', () => {
  const previous = process.env.FOCUS_NFE_TOKEN;
  process.env.FOCUS_NFE_TOKEN = '';
  assert.equal(focusNfeToken({ focusNfeToken: 'token-ajustes' }), 'token-ajustes');
  process.env.FOCUS_NFE_TOKEN = 'token-env';
  assert.equal(focusNfeToken({ focusNfeToken: 'token-ajustes' }), 'token-env');
  const ready = fiscalReadiness({ ...settings, focusNfeToken: 'token-ajustes' });
  assert.equal(ready.canEmit, true);
  assert.equal(ready.hasToken, true);
  process.env.FOCUS_NFE_TOKEN = previous;
});
