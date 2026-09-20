import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/services/userService.js';
import { signToken } from '../src/middleware/auth.js';
import { router } from '../src/routes/index.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI_AZ || 'mongodb://127.0.0.1:27017/bikeger_test_az';

before(async () => {
  await mongoose.connect(uri);
  await User.deleteMany({});
});

after(async () => {
  await flushJobs();
  await mongoose.disconnect();
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use(errorHandler);
  return app;
}

async function tokenFor(role) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const user = await User.create({
    name: role,
    login: `${role}-${suffix}`,
    passwordHash: await hashPassword('senhateste1'),
    role,
    active: true,
  });
  return signToken(user);
}

async function request(path, token) {
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('mecânico recebe 403 em compras, vendas, usuários e ajustes', async () => {
  const token = await tokenFor('mecanico');
  const paths = ['/api/purchases', '/api/sales', '/api/users', '/api/settings'];
  for (const path of paths) {
    const res = await request(path, token);
    assert.equal(res.status, 403, path);
    assert.equal(res.body.message, 'Seu perfil não tem acesso a esta ação');
  }
});

test('dono lê ajustes sem 403', async () => {
  const token = await tokenFor('dono');
  const res = await request('/api/settings', token);
  assert.equal(res.status, 200);
  assert.equal(res.body.storeName !== undefined, true);
});
