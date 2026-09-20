import { AuditEvent } from '../models/AuditEvent.js';
import { log } from '../utils/logger.js';

export async function recordAudit({ action, actor, target, meta = {} }) {
  const actorLogin = actor?.login || '';
  const targetLogin = target?.login || '';
  const doc = {
    action,
    actorId: actor?.id || actor?._id || null,
    actorLogin,
    targetId: target?.id || target?._id || null,
    targetLogin,
    meta,
  };

  log('info', action, {
    actor: actorLogin,
    target: targetLogin,
    ...meta,
  });

  try {
    await AuditEvent.create(doc);
  } catch (error) {
    log('error', 'Falha ao gravar auditoria', { action, message: error.message });
  }
}

export async function listAuditEvents({ action, limit = 80 } = {}) {
  const filter = {};
  if (action) filter.action = action;
  const cap = Math.min(Math.max(Number(limit) || 80, 1), 200);
  return AuditEvent.find(filter).sort({ createdAt: -1 }).limit(cap);
}
