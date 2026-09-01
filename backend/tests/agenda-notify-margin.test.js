import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accumulateByCategory, lineMargin } from '../src/utils/margin.js';
import { buildReadyMessage, phoneToWhatsApp, whatsappUrl } from '../src/utils/notify.js';
import { sendWhatsAppCloud, whatsappCloudConfig } from '../src/utils/whatsappCloud.js';
import { dateKey, weekFrom } from '../src/services/agendaService.js';

test('margem da linha desconta devolução e fica em centavos', () => {
  const full = lineMargin({ unitPrice: 7990, unitCost: 4500, quantity: 2 });
  assert.equal(full.revenue, 15980);
  assert.equal(full.cost, 9000);
  assert.equal(full.profit, 6980);

  const afterReturn = lineMargin({
    unitPrice: 7990,
    unitCost: 4500,
    quantity: 2,
    returnedQuantity: 1,
  });
  assert.equal(afterReturn.revenue, 7990);
  assert.equal(afterReturn.profit, 3490);
});

test('margem agrupa por categoria', () => {
  const rows = accumulateByCategory([
    { category: 'Freios', revenue: 10000, cost: 4000, profit: 6000, quantity: 2 },
    { category: 'Freios', revenue: 5000, cost: 2000, profit: 3000, quantity: 1 },
    { category: 'Transmissão', revenue: 8000, cost: 7000, profit: 1000, quantity: 1 },
  ]);
  assert.equal(rows[0].category, 'Freios');
  assert.equal(rows[0].profit, 9000);
  assert.equal(rows[1].category, 'Transmissão');
});

test('WhatsApp monta link com DDI 55', () => {
  assert.equal(phoneToWhatsApp('(11) 98888-0000'), '5511988880000');
  const url = whatsappUrl('11988880000', 'Bike pronta');
  assert.match(url, /^https:\/\/wa\.me\/5511988880000\?text=/);
});

test('texto do aviso troca nome, bike, OS e loja', () => {
  const text = buildReadyMessage({
    template: '{nome}, a {bike} da OS {os} está pronta na {loja}.',
    storeName: 'BikeGer',
    customerName: 'Ana',
    bikeLabel: 'Caloi 10',
    number: 'OS-00012',
  });
  assert.equal(text, 'Ana, a Caloi 10 da OS OS-00012 está pronta na BikeGer.');
});

test('Cloud API usa token do .env se os dois existirem', () => {
  const previous = process.env.WHATSAPP_TOKEN;
  process.env.WHATSAPP_TOKEN = 'env-token';
  const cfg = whatsappCloudConfig({
    whatsappToken: 'ajustes-token',
    whatsappPhoneNumberId: '123',
  });
  assert.equal(cfg.token, 'env-token');
  assert.equal(cfg.configured, true);
  assert.equal(cfg.tokenFromEnv, true);
  process.env.WHATSAPP_TOKEN = previous;
});

test('Cloud API envia texto para o Graph e devolve message id', async () => {
  const calls = [];
  const result = await sendWhatsAppCloud({
    token: 'tok',
    phoneNumberId: '999',
    phone: '11988880000',
    body: 'OS pronta',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.abc' }] }),
      };
    },
  });
  assert.equal(result.messageId, 'wamid.abc');
  assert.match(calls[0].url, /graph\.facebook\.com\/v21\.0\/999\/messages/);
  assert.equal(JSON.parse(calls[0].options.body).to, '5511988880000');
});

test('semana da agenda começa na segunda', () => {
  const { from, to } = weekFrom(new Date('2026-08-30T15:00:00'));
  assert.equal(dateKey(from), '2026-08-24');
  assert.equal(dateKey(new Date(to.getTime() - 1)), '2026-08-30');
});
