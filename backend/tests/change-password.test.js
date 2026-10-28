import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import {
  changeOwnPassword,
  createUser,
  hashPassword,
  updateUser,
  verifyPassword,
} from '../src/services/userService.js';
import { MUST_CHANGE_PASSWORD_MESSAGE, signToken } from '../src/middleware/auth.js';
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
  assert.equal(fresh.mustChangePassword, false);
});

test('usuário criado pelo dono troca a senha no primeiro acesso', async () => {
  const created = await createUser({
    name: 'Ana',
    login: `ana-${Date.now()}`,
    password: 'senhateste1',
    role: 'balcao',
  });
  assert.equal(created.mustChangePassword, true);

  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    const blocked = await fetch(`http://127.0.0.1:${port}/api/dashboard`, {
      headers: { Authorization: `Bearer ${signToken(created)}` },
    });
    const blockedBody = await blocked.json();
    assert.equal(blocked.status, 403);
    assert.equal(blockedBody.message, MUST_CHANGE_PASSWORD_MESSAGE);

    const me = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${signToken(created)}` },
    });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meBody.mustChangePassword, true);
  } finally {
    server.close();
    await once(server, 'close');
  }

  await updateUser(created._id, { password: 'temporaria1' });
  const afterReset = await User.findById(created._id);
  assert.equal(afterReset.mustChangePassword, true);

  const changed = await changeOwnPassword(
    created._id,
    { currentPassword: 'temporaria1', newPassword: 'senhanova1' },
    { actor: created },
  );
  assert.equal(changed.mustChangePassword, false);
});
