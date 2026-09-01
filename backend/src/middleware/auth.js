import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { httpError } from '../utils/asyncHandler.js';
import { capabilitiesFor, can } from '../utils/roles.js';
import { tokenSecret } from '../utils/security.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, name: user.name, login: user.login },
    tokenSecret(),
    { expiresIn: '12h' },
  );
}

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    login: user.login,
    role: user.role,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    capabilities: capabilitiesFor(user.role),
  };
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw httpError(401, 'Faça login para continuar');

    const payload = jwt.verify(token, tokenSecret());
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw httpError(401, 'Sessão inválida. Entre de novo.');

    req.user = publicUser(user);
    next();
  } catch (error) {
    if (error.status) {
      next(error);
      return;
    }
    next(httpError(401, 'Sessão expirada. Entre de novo.'));
  }
}

export function requireCapability(...capabilities) {
  return (req, _res, next) => {
    if (!req.user) {
      next(httpError(401, 'Faça login para continuar'));
      return;
    }
    const allowed = capabilities.some((capability) => can(req.user.role, capability));
    if (!allowed) {
      next(httpError(403, 'Seu perfil não tem acesso a esta ação'));
      return;
    }
    next();
  };
}

export function operatorName(req) {
  return req.user?.name || 'sistema';
}
