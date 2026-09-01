import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { securityHeaders } from '../src/middleware/securityHeaders.js';

test('Helmet manda headers de segurança e deixa o painel em outra origem ler a API', async () => {
  const app = express();
  app.use(securityHeaders());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.ok(res.headers.get('strict-transport-security'));
  } finally {
    server.close();
    await once(server, 'close');
  }
});
