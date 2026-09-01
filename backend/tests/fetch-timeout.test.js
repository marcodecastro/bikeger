import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FETCH_TIMEOUT_MESSAGE,
  DEFAULT_FISCAL_TIMEOUT_MS,
  DEFAULT_WHATSAPP_TIMEOUT_MS,
  fetchWithTimeout,
  fiscalTimeoutMs,
  whatsappTimeoutMs,
} from '../src/utils/fetchTimeout.js';
import { sendWhatsAppCloud } from '../src/utils/whatsappCloud.js';

function hangingFetch(_url, { signal }) {
  return new Promise((_, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

test('fetchWithTimeout recusa espera infinita', async () => {
  await assert.rejects(
    () => fetchWithTimeout('http://example.test/nfce', {}, 30, hangingFetch),
    (error) => error.message === FETCH_TIMEOUT_MESSAGE,
  );
});

test('fetchWithTimeout devolve a resposta se ela chegar a tempo', async () => {
  const res = await fetchWithTimeout(
    'http://example.test/ok',
    {},
    200,
    async () => ({ ok: true, status: 200 }),
  );
  assert.equal(res.ok, true);
});

test('NFC-e espera mais que o WhatsApp (SEFAZ é lenta)', () => {
  assert.equal(fiscalTimeoutMs(), DEFAULT_FISCAL_TIMEOUT_MS);
  assert.equal(whatsappTimeoutMs(), DEFAULT_WHATSAPP_TIMEOUT_MS);
  assert.ok(fiscalTimeoutMs() > whatsappTimeoutMs());
});

test('Cloud API não espera o Graph para sempre', async () => {
  await assert.rejects(
    () =>
      sendWhatsAppCloud({
        token: 'tok',
        phoneNumberId: '999',
        phone: '11988880000',
        body: 'OS pronta',
        timeoutMs: 30,
        fetchImpl: hangingFetch,
      }),
    (error) => error.message === FETCH_TIMEOUT_MESSAGE,
  );
});
