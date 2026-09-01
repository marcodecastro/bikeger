import { CashRegister } from '../models/CashRegister.js';
import { addCents, assertCents, subtractCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';

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

  for (const movement of register.movements) {
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

export const ALREADY_OPEN_MESSAGE = 'Já existe um caixa aberto';

export async function openRegister({ openingAmount = 0, operator = 'caixa' }) {
  const open = await getOpenRegister();
  if (open) throw httpError(409, ALREADY_OPEN_MESSAGE);
  try {
    const register = await CashRegister.create({
      openingAmount: assertCents(openingAmount, 'fundo de caixa'),
      operator,
      expectedCash: assertCents(openingAmount, 'fundo de caixa'),
    });
    return withSummary(register);
  } catch (error) {
    if (error.code === 11000) throw httpError(409, ALREADY_OPEN_MESSAGE);
    throw error;
  }
}

export async function registerLedgerMovement({
  type,
  amount,
  notes = '',
  referenceId = null,
  method = 'dinheiro',
  session = null,
}) {
  const register = await requireOpenRegister(session);

  assertCents(amount, 'movimento de caixa');
  register.movements.push({
    type,
    method: type === 'sangria' || type === 'suprimento' ? 'dinheiro' : method,
    amount,
    notes,
    referenceId,
  });
  register.expectedCash = summarizeRegister(register).expectedCash;
  await register.save({ session: session || undefined });
  return withSummary(register);
}

export async function reverseLedgerForReference(referenceId, session = null) {
  const register = await requireOpenRegister(session);

  const others = await CashRegister.find({
    _id: { $ne: register._id },
    'movements.referenceId': referenceId,
  }).session(session || undefined);

  const net = new Map();
  for (const book of [register, ...others]) {
    addReferenceNet(net, book, referenceId);
  }

  const pending = [...net.entries()].filter(([, amount]) => amount > 0);
  if (!pending.length) return withSummary(register);

  for (const [method, amount] of pending) {
    register.movements.push({
      type: 'estorno',
      method,
      amount,
      notes: 'Estorno restante',
      referenceId,
    });
  }

  register.expectedCash = summarizeRegister(register).expectedCash;
  await register.save({ session: session || undefined });
  return withSummary(register);
}

function addReferenceNet(net, register, referenceId) {
  for (const movement of register.movements) {
    if (String(movement.referenceId || '') !== String(referenceId)) continue;
    if (movement.type === 'sangria' || movement.type === 'suprimento') continue;
    const method = movement.method || 'dinheiro';
    const sign = movement.type === 'estorno' ? -1 : 1;
    net.set(method, (net.get(method) || 0) + sign * movement.amount);
  }
}

/** Compatível com a rota antiga de sangria/suprimento. */
export async function registerCashMovement(payload) {
  return registerLedgerMovement(payload);
}

export async function closeRegister({ countedCash, notes = '' }) {
  const register = await getOpenRegister();
  if (!register) throw httpError(404, 'Nenhum caixa aberto');

  const summary = summarizeRegister(register);
  register.countedCash = assertCents(countedCash, 'dinheiro contado');
  register.expectedCash = summary.expectedCash;
  register.difference = subtractCents(register.countedCash, register.expectedCash);
  register.status = 'fechado';
  register.closedAt = new Date();
  register.notes = notes;
  await register.save();
  return withSummary(register);
}
