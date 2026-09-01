import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ROLES } from '../utils/roles.js';
import { httpError } from '../utils/asyncHandler.js';
import { shouldSeedDemoUsers } from '../utils/security.js';

const SALT_ROUNDS = 10;
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_TOO_SHORT_MESSAGE = 'A senha precisa ter pelo menos 8 caracteres';

const DEFAULT_USERS = [
  { name: 'Marco', login: 'dono', role: 'dono', password: 'bikeger' },
  { name: 'Rita', login: 'balcao', role: 'balcao', password: 'bikeger' },
  { name: 'Léo', login: 'mecanico', role: 'mecanico', password: 'bikeger' },
];

export async function hashPassword(password, { allowDemo = false } = {}) {
  const value = String(password || '');
  if (!value || (allowDemo ? value.length < 6 : value.length < MIN_PASSWORD_LENGTH)) {
    throw httpError(400, PASSWORD_TOO_SHORT_MESSAGE);
  }
  return bcrypt.hash(value, SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export async function ensureDefaultUsers() {
  if (!shouldSeedDemoUsers()) {
    console.log('Usuários demo não são criados em produção (ALLOW_DEMO_USERS=false).');
    return;
  }
  for (const account of DEFAULT_USERS) {
    const exists = await User.findOne({ login: account.login });
    if (exists) continue;
    try {
      await User.create({
        name: account.name,
        login: account.login,
        role: account.role,
        passwordHash: await hashPassword(account.password, { allowDemo: true }),
      });
      console.log(`Usuário padrão criado: ${account.login} / ${account.password} (${account.role})`);
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
}

export async function authenticate(login, password) {
  const user = await User.findOne({ login: String(login || '').trim().toLowerCase() });
  if (!user || !user.active) throw httpError(401, 'Login ou senha inválidos');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw httpError(401, 'Login ou senha inválidos');
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function createUser({ name, login, password, role }) {
  if (!ROLES.includes(role)) throw httpError(400, 'Perfil inválido');
  const normalized = String(login || '').trim().toLowerCase();
  if (!normalized) throw httpError(400, 'Informe o login');
  const exists = await User.findOne({ login: normalized });
  if (exists) throw httpError(409, 'Já existe alguém com esse login');

  return User.create({
    name,
    login: normalized,
    role,
    passwordHash: await hashPassword(password),
  });
}

export async function updateUser(id, patch) {
  const user = await User.findById(id);
  if (!user) throw httpError(404, 'Usuário não encontrado');

  if (patch.name !== undefined) user.name = patch.name;
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) throw httpError(400, 'Perfil inválido');
    if (user.role === 'dono' && patch.role !== 'dono') {
      const owners = await User.countDocuments({ role: 'dono', active: true, _id: { $ne: user._id } });
      if (!owners) throw httpError(400, 'Precisa restar pelo menos um dono ativo');
    }
    user.role = patch.role;
  }
  if (patch.active !== undefined) {
    if (user.role === 'dono' && patch.active === false) {
      const owners = await User.countDocuments({ role: 'dono', active: true, _id: { $ne: user._id } });
      if (!owners) throw httpError(400, 'Não dá para desativar o último dono');
    }
    user.active = patch.active;
  }
  if (patch.password) user.passwordHash = await hashPassword(patch.password);

  await user.save();
  return user;
}
