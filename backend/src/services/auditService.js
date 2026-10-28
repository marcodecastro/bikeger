import { AuditEvent } from '../models/AuditEvent.js';
import { log } from '../utils/logger.js';
import { listLimit, listSkip } from '../utils/listLimit.js';
import { searchRegex } from '../utils/searchRegex.js';

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

export async function listAuditEvents({ action, from, to, q, skip, limit = 80 } = {}) {
  const filter = {};
  if (action) filter.action = action;
  const rx = searchRegex(q);
  if (rx) {
    filter.$or = [{ actorLogin: rx }, { targetLogin: rx }, { action: rx }];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return AuditEvent.find(filter)
    .sort({ createdAt: -1 })
    .skip(listSkip(skip))
    .limit(listLimit(limit, 80));
}
