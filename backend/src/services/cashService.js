import { CashRegister } from '../models/CashRegister.js';
import { CashMovement } from '../models/CashMovement.js';
import { FiscalDocument } from '../models/FiscalDocument.js';
import { getSettings } from '../models/Settings.js';
import { addCents, assertCents, subtractCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { enqueueJob } from '../utils/jobs.js';
import { logError } from '../utils/logger.js';
import { recordAudit } from './auditService.js';
import { drainPaymentApplyOutbox } from './paymentOutbox.js';
import { buildDayReportReceipt } from './printerService.js';

const EMPTY_METHODS = {
  dinheiro: 0,
  pix: 0,
  cartao_credito: 0,
  cartao_debito: 0,
  mercado_pago: 0,
};

export const CASH_CLOSED_MESSAGE =
  'Nenhum caixa aberto. Abra o caixa para registrar este movimento.';

export async function getOpenRegister() {
  return CashRegister.findOne({ status: 'aberto' }).sort({ openedAt: -1 });
}

export async function requireOpenRegister(session = null) {
  const register = await CashRegister.findOne({ status: 'aberto' })
    .sort({ openedAt: -1 })
    .session(session || undefined);
  if (!register) throw httpError(409, CASH_CLOSED_MESSAGE);
  return register;
}

export function summarizeRegister(register) {
  const byMethod = { ...EMPTY_METHODS };
  let expectedCash = assertCents(register.openingAmount || 0, 'fundo de caixa');

  for (const movement of register.movements || []) {
    assertCents(movement.amount, 'movimento de caixa');
    if (movement.type === 'sangria') {
      expectedCash = subtractCents(expectedCash, movement.amount);
      continue;
    }
    if (movement.type === 'suprimento') {
      expectedCash = addCents(expectedCash, movement.amount);
      continue;
    }
    const method = movement.method || 'dinheiro';
    if (movement.type === 'estorno') {
      byMethod[method] = subtractCents(byMethod[method] || 0, movement.amount);
      if (method === 'dinheiro') {
        expectedCash = subtractCents(expectedCash, movement.amount);
      }
      continue;
    }
    byMethod[method] = addCents(byMethod[method] || 0, movement.amount);
    if (method === 'dinheiro') {
      expectedCash = addCents(expectedCash, movement.amount);
    }
  }

  const receivedTotal = Object.values(byMethod).reduce((sum, value) => addCents(sum, value), 0);

  return {
    byMethod,
    expectedCash,
    receivedTotal,
    openingAmount: register.openingAmount,
  };
}

export function withSummary(register) {
  if (!register) return null;
  const data = typeof register.toObject === 'function' ? register.toObject() : { ...register };
  const summary = summarizeRegister(register);
  data.summary = summary;
  data.expectedCash = summary.expectedCash;
  return data;
}

export async function withLedgerSummary(register, session = null) {
  if (!register) return null;
  const data = typeof register.toObject === 'function' ? register.toObject() : { ...register };
  const ledger = await CashMovement.find({ registerId: data._id })
    .sort({ createdAt: 1 })
    .session(session || undefined)
    .lean();
  const movements = ledger.length ? ledger : data.movements || [];
  const summary = summarizeRegister({ openingAmount: data.openingAmount, movements });
  data.summary = summary;
  data.expectedCash = summary.expectedCash;
  return data;
}

export const ALREADY_OPEN_MESSAGE = 'Já existe um caixa aberto';

export async function openRegister({ openingAmount = 0, operator = 'caixa', actor } = {}) {
  const open = await getOpenRegister();
  if (open) throw httpError(409, ALREADY_OPEN_MESSAGE);
  try {
    const register = await CashRegister.create({
      openingAmount: assertCents(openingAmount, 'fundo de caixa'),
      operator,
      expectedCash: assertCents(openingAmount, 'fundo de caixa'),
    });
    await recordAudit({
      action: 'cash.opened',
      actor: actor || { login: operator },
      meta: { registerId: String(register._id), openingAmount: register.openingAmount },
    });
    try {
      await drainPaymentApplyOutbox();
    } catch (error) {
      logError(error, null, { job: 'payment.drain', when: 'openRegister' });
    }
    enqueueJob('payment.drain', {});
    return withSummary(register);
  } catch (error) {
    if (error.code === 11000) throw httpError(409, ALREADY_OPEN_MESSAGE);
    throw error;
  }
}

async function persistExtractedMovement({
  register,
  type,
  method,
  amount,
  notes,
  referenceId,
  operator = '',
  session = null,
}) {
  const docs = [
    {
      registerId: register._id,
      type,
      method,
      amount,
      notes,
      referenceId,
      operator,
    },
  ];
  if (session) await CashMovement.create(docs, { session });
  else await CashMovement.create(docs);
}

export async function registerLedgerMovement({
  type,
  amount,
  notes = '',
  referenceId = null,
  method = 'dinheiro',
  operator = '',
  session = null,
}) {
  const register = await requireOpenRegister(session);

  assertCents(amount, 'movimento de caixa');
  const resolvedMethod = type === 'sangria' || type === 'suprimento' ? 'dinheiro' : method;
  await persistExtractedMovement({
    register,
    type,
    method: resolvedMethod,
    amount,
    notes,
    referenceId,
    operator,
    session,
  });
  const pushed = await CashRegister.findOneAndUpdate(
    { _id: register._id, status: 'aberto' },
    {
      $push: {
        movements: {
          type,
          method: resolvedMethod,
          amount,
          notes,
          referenceId,
        },
      },
    },
    { new: true, session: session || undefined },
  );
  if (!pushed) throw httpError(409, CASH_CLOSED_MESSAGE);

  const ledger = await CashMovement.find({ registerId: pushed._id }).session(session || undefined);
  const summary = summarizeRegister({ openingAmount: pushed.openingAmount, movements: ledger });
  pushed.expectedCash = summary.expectedCash;
  await CashRegister.updateOne(
    { _id: pushed._id },
    { $set: { expectedCash: summary.expectedCash } },
    { session: session || undefined },
  );
  return withSummary(pushed);
}

export async function reverseLedgerForReference(referenceId, session = null) {
  const register = await requireOpenRegister(session);
  let history = await CashMovement.find({ referenceId }).session(session || undefined);
  if (!history.length) {
    const books = await CashRegister.find({ 'movements.referenceId': referenceId }).session(
      session || undefined,
    );
    history = books.flatMap((book) =>
      (book.movements || []).filter(
        (movement) => String(movement.referenceId || '') === String(referenceId),
      ),
    );
  }

  const net = new Map();
  for (const movement of history) {
    if (movement.type === 'sangria' || movement.type === 'suprimento') continue;
    const method = movement.method || 'dinheiro';
    const sign = movement.type === 'estorno' ? -1 : 1;
    net.set(method, (net.get(method) || 0) + sign * movement.amount);
  }

  const pending = [...net.entries()].filter(([, amount]) => amount > 0);
  if (!pending.length) return withSummary(register);

  let last = register;
  for (const [method, amount] of pending) {
    last = await registerLedgerMovement({
      type: 'estorno',
      method,
      amount,
      notes: 'Estorno restante',
      referenceId,
      session,
    });
  }
  return last;
}

function sumByType(movements, type) {
  return (movements || [])
    .filter((movement) => movement.type === type)
    .reduce((sum, movement) => addCents(sum, movement.amount), 0);
}

export async function buildDayReport(register) {
  const settings = await getSettings();
  const ledger = await CashMovement.find({ registerId: register._id }).sort({ createdAt: 1 });
  const movements = ledger.length ? ledger : register.movements || [];
  const summary = summarizeRegister({ openingAmount: register.openingAmount, movements });
  const osRefs = new Set(
    movements
      .filter((movement) => movement.type === 'os' && movement.referenceId)
      .map((movement) => String(movement.referenceId)),
  );
  const fiscalEnabled = Boolean(settings.fiscalEnabled);
  const nfcePending = fiscalEnabled
    ? await FiscalDocument.countDocuments({ status: { $in: ['pendente', 'processando'] } })
    : 0;

  return {
    registerId: String(register._id),
    openedAt: register.openedAt,
    closedAt: register.closedAt,
    operator: register.operator,
    openingAmount: summary.openingAmount,
    countedCash: register.countedCash || 0,
    expectedCash: summary.expectedCash,
    difference: register.difference || 0,
    byMethod: summary.byMethod,
    receivedTotal: summary.receivedTotal,
    sangria: sumByType(movements, 'sangria'),
    suprimento: sumByType(movements, 'suprimento'),
    osTotal: sumByType(movements, 'os'),
    osCount: osRefs.size,
    estorno: sumByType(movements, 'estorno'),
    fiscalEnabled,
    nfcePending,
    notes: register.notes || '',
  };
}

export async function listCashMovements({ from, to, type, method, limit = 200 } = {}) {
  const filter = {};
  if (type) filter.type = type;
  if (method) filter.method = method;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  return CashMovement.find(filter).sort({ createdAt: -1 }).limit(cap);
}

/** Compatível com a rota antiga de sangria/suprimento. Venda e OS não entram por aqui. */
export const MANUAL_CASH_TYPES = ['sangria', 'suprimento'];
export const MANUAL_CASH_ONLY_MESSAGE =
  'Só sangria e suprimento podem ser lançados neste livro. Venda e OS entram sozinhas.';

export async function registerCashMovement(payload) {
  if (!MANUAL_CASH_TYPES.includes(payload?.type)) {
    throw httpError(400, MANUAL_CASH_ONLY_MESSAGE);
  }
  const register = await registerLedgerMovement(payload);
  await recordAudit({
    action: `cash.${payload.type}`,
    actor: payload.actor || { login: payload.operator || '' },
    meta: { amount: payload.amount, notes: payload.notes || '', method: 'dinheiro' },
  });
  return register;
}

export async function closeRegister({ countedCash, notes = '', actor } = {}) {
  const register = await getOpenRegister();
  if (!register) throw httpError(404, 'Nenhum caixa aberto');

  const summarized = await withLedgerSummary(register);
  register.countedCash = assertCents(countedCash, 'dinheiro contado');
  register.expectedCash = summarized.summary.expectedCash;
  register.difference = subtractCents(register.countedCash, register.expectedCash);
  register.status = 'fechado';
  register.closedAt = new Date();
  register.notes = notes;
  await register.save();

  const day = await buildDayReport(register);
  const dayReport = await buildDayReportReceipt(day);

  await recordAudit({
    action: 'cash.closed',
    actor: actor || { login: register.operator },
    meta: {
      registerId: String(register._id),
      countedCash: register.countedCash,
      expectedCash: register.expectedCash,
      difference: register.difference,
    },
  });

  enqueueJob('backup.daily', {});

  return { ...(await withLedgerSummary(register)), dayReport, day };
}
