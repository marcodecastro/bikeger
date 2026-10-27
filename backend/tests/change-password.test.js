import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { hashPassword, verifyPassword } from '../src/services/userService.js';
import { signToken } from '../src/middleware/auth.js';
import { router } from '../src/routes/index.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { flushJobs } from '../src/utils/jobs.js';

const uri = process.env.MONGODB_TEST_URI_PW || 'mongodb://127.0.0.1:27017/bikeger_test_pw';

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

async function postJson(path, token, body) {
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    return { status: res.status, body: payload };
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('mecânico troca a própria senha sem passar pela equipe', async () => {
  const user = await User.create({
    name: 'Léo',
    login: `mecanico-${Date.now()}`,
    passwordHash: await hashPassword('senhateste1'),
    role: 'mecanico',
    active: true,
  });
  const token = signToken(user);

  const wrong = await postJson('/api/auth/change-password', token, {
    currentPassword: 'erradaaaaa',
    newPassword: 'senhanova1',
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.message, 'Senha atual não confere');

  const ok = await postJson('/api/auth/change-password', token, {
    currentPassword: 'senhateste1',
    newPassword: 'senhanova1',
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.login, user.login);

  const fresh = await User.findById(user._id);
  assert.equal(await verifyPassword('senhanova1', fresh.passwordHash), true);
});
