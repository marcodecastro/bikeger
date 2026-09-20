import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  assertBootConfig,
  assertFrontendUrl,
  assertJwtConfig,
  assertSeedAllowed,
  API_PUBLIC_URL_REQUIRED_MESSAGE,
  assertReplicaSet,
  REPLICA_SET_REQUIRED_MESSAGE,
  checkoutBackUrls,
  corsOrigin,
  DEV_FRONTEND_ORIGIN,
  FRONTEND_URL_REQUIRED_MESSAGE,
  paymentReturnUrl,
  publicApiUrl,
  redactMongoUri,
  SEED_BLOCKED_MESSAGE,
  shouldSeedDemoUsers,
  tokenSecret,
} from '../src/utils/security.js';
import { verifyAccessToken } from '../src/middleware/auth.js';

test('produção recusa JWT de exemplo e não cria senha bikeger', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  const previousDemo = process.env.ALLOW_DEMO_USERS;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'gere-uma-chave-longa-aleatoria-local';
  process.env.ALLOW_DEMO_USERS = 'true';

  assert.throws(() => assertJwtConfig(), /JWT_SECRET forte é obrigatório/);
  assert.throws(() => tokenSecret(), /JWT_SECRET inválido/);
  assert.equal(shouldSeedDemoUsers(), false);

  process.env.NODE_ENV = previousEnv;
  process.env.JWT_SECRET = previousSecret;
  process.env.ALLOW_DEMO_USERS = previousDemo;
});

test('desenvolvimento pode usar fallback, mas demo só se permitido', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  const previousDemo = process.env.ALLOW_DEMO_USERS;
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = '';
  process.env.ALLOW_DEMO_USERS = 'false';

  assert.doesNotThrow(() => assertJwtConfig());
  assert.equal(tokenSecret(), 'bikeger-dev-secret');
  assert.equal(shouldSeedDemoUsers(), false);

  process.env.ALLOW_DEMO_USERS = 'true';
  assert.equal(shouldSeedDemoUsers(), true);

  process.env.NODE_ENV = previousEnv;
  process.env.JWT_SECRET = previousSecret;
  process.env.ALLOW_DEMO_USERS = previousDemo;
});

test('produção recusa o seed que apaga o banco', () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  assert.throws(() => assertSeedAllowed(), (error) => error.message === SEED_BLOCKED_MESSAGE);
  process.env.NODE_ENV = previousEnv;
});

test('desenvolvimento deixa o seed correr', () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  assert.doesNotThrow(() => assertSeedAllowed());
  process.env.NODE_ENV = previousEnv;
});

test('produção recusa subir sem FRONTEND_URL', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  const previousOrigin = process.env.FRONTEND_URL;
  const previousApi = process.env.API_PUBLIC_URL;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'chave-longa-aleatoria-de-producao-bikeger';
  process.env.FRONTEND_URL = '';

  assert.throws(() => assertFrontendUrl(), (error) => error.message === FRONTEND_URL_REQUIRED_MESSAGE);
  assert.throws(() => assertBootConfig(), /FRONTEND_URL é obrigatório/);

  process.env.FRONTEND_URL = '*';
  assert.throws(() => assertFrontendUrl(), /FRONTEND_URL é obrigatório/);

  process.env.FRONTEND_URL = 'https://loja.bikeger.local';
  process.env.API_PUBLIC_URL = '';
  assert.throws(() => assertBootConfig(), /API_PUBLIC_URL é obrigatório/);
  assert.throws(() => publicApiUrl(), (error) => error.message === API_PUBLIC_URL_REQUIRED_MESSAGE);

  process.env.API_PUBLIC_URL = 'http://localhost:4000';
  assert.throws(() => assertBootConfig(), /API_PUBLIC_URL é obrigatório/);

  process.env.API_PUBLIC_URL = 'https://api.bikeger.local';
  assert.doesNotThrow(() => assertBootConfig());
  assert.equal(corsOrigin(), 'https://loja.bikeger.local');

  process.env.NODE_ENV = previousEnv;
  process.env.JWT_SECRET = previousSecret;
  process.env.FRONTEND_URL = previousOrigin;
  process.env.API_PUBLIC_URL = previousApi;
});

test('desenvolvimento não abre CORS para qualquer origem', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousOrigin = process.env.FRONTEND_URL;
  process.env.NODE_ENV = 'development';
  process.env.FRONTEND_URL = '';
  assert.doesNotThrow(() => assertFrontendUrl());
  assert.equal(corsOrigin(), DEV_FRONTEND_ORIGIN);
  assert.notEqual(corsOrigin(), true);

  process.env.FRONTEND_URL = '*';
  assert.equal(corsOrigin(), DEV_FRONTEND_ORIGIN);

  process.env.FRONTEND_URL = 'https://loja.bikeger.local/';
  assert.equal(corsOrigin(), 'https://loja.bikeger.local');
  assert.equal(paymentReturnUrl(), 'https://loja.bikeger.local/pagamentos/retorno');
  assert.equal(checkoutBackUrls().success, 'https://loja.bikeger.local/pagamentos/retorno');

  process.env.NODE_ENV = previousEnv;
  process.env.FRONTEND_URL = previousOrigin;
});

test('produção recusa Mongo standalone, no mesmo espírito do API_PUBLIC_URL', () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  assert.throws(
    () => assertReplicaSet({ transactions: false }),
    (error) => error.message === REPLICA_SET_REQUIRED_MESSAGE,
  );
  assert.doesNotThrow(() => assertReplicaSet({ transactions: true, setName: 'rs0' }));
  process.env.NODE_ENV = 'development';
  assert.doesNotThrow(() => assertReplicaSet({ transactions: false }));
  process.env.NODE_ENV = previousEnv;
});

test('URI Mongo com senha some do log', () => {
  assert.equal(
    redactMongoUri('mongodb://marco:segredo@127.0.0.1:27017/bikeger'),
    'mongodb://***@127.0.0.1:27017/bikeger',
  );
  assert.equal(
    redactMongoUri('mongodb+srv://marco:s3nha@cluster.mongodb.net/bikeger?retryWrites=true'),
    'mongodb+srv://***@cluster.mongodb.net/bikeger?retryWrites=true',
  );
  assert.equal(
    redactMongoUri('mongodb://127.0.0.1:27017/bikeger'),
    'mongodb://127.0.0.1:27017/bikeger',
  );
  assert.match(
    redactMongoUri('Falha: mongodb://u:p@host:27017/bikeger ECONNREFUSED'),
    /mongodb:\/\/\*\*\*@host:27017\/bikeger/,
  );
});

test('jwt.verify recusa alg none e só aceita HS256', () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const none = [Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'), Buffer.from('{"sub":"x"}').toString('base64url'), ''].join('.');
  assert.throws(() => verifyAccessToken(none));
  const token = jwt.sign({ sub: 'ok' }, tokenSecret(), { algorithm: 'HS256' });
  assert.equal(verifyAccessToken(token).sub, 'ok');
  process.env.NODE_ENV = previousEnv;
});
