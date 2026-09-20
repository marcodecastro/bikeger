import { WorkOrder } from '../models/WorkOrder.js';
import { Product } from '../models/Product.js';
import { Service } from '../models/Service.js';
import { Bike } from '../models/Bike.js';
import { nextNumber } from '../utils/ids.js';
import { addCents, assertCents, multiplyCents, subtractCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { applyStockMovement, consumeReservation, releaseReservation, reserveStock } from './stockService.js';
import { registerLedgerMovement, requireOpenRegister, reverseLedgerForReference } from './cashService.js';
import { runInTransaction } from '../utils/transaction.js';
import { enqueueJob } from '../utils/jobs.js';
import { recordAudit } from './auditService.js';
import { listLimit } from '../utils/listLimit.js';
import {
  assertWorkOrderOpen,
  assertWorkOrderTransition,
  isWorkOrderQuoteStatus,
  isWorkOrderTerminal,
  WORK_ORDER_KANBAN_STATUSES,
  WORK_ORDER_RESERVE_STATUSES,
} from '../utils/workOrderStatus.js';

const CONSUME_STATUSES = new Set(['em_servico', 'pronta', 'entregue']);
export const PAYMENT_EXCEEDS_TOTAL_MESSAGE = 'Pagamento maior que o valor em aberto';
export const WORK_ORDER_CONFLICT_MESSAGE = 'A OS mudou em outra tela. Atualize e tente de novo.';

export function recalcWorkOrder(order) {
  order.laborTotal = order.services.reduce((sum, item) => addCents(sum, item.total), 0);
  order.partsTotal = order.parts.reduce((sum, item) => addCents(sum, item.total), 0);
  order.discount = assertCents(order.discount || 0, 'desconto');
  const gross = addCents(order.laborTotal, order.partsTotal);
  if (order.discount > gross) throw httpError(400, 'Desconto maior que o total da OS');
  order.total = subtractCents(gross, order.discount);
  order.paidAmount = order.payments
    .filter((payment) => payment.status === 'aprovado')
    .reduce((sum, payment) => addCents(sum, payment.amount), 0);
  return order;
}

async function loadOrder(id, session) {
  const order = await WorkOrder.findById(id).session(session || undefined);
  if (!order) throw httpError(404, 'OS não encontrada');
  return order;
}

async function persistOrder(order, session) {
  const expectedVersion = order.__v;
  const data = order.toObject({ depopulate: true, versionKey: false, virtuals: false });
  delete data._id;
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;

  try {
    const result = await WorkOrder.updateOne(
      { _id: order._id, __v: expectedVersion },
      { $set: data, $inc: { __v: 1 } },
      { session: session || undefined },
    );
    if (result.matchedCount === 0) {
      throw httpError(409, WORK_ORDER_CONFLICT_MESSAGE);
    }
    order.__v = expectedVersion + 1;
  } catch (error) {
    if (error.status === 409) throw error;
    if (error.name === 'VersionError') throw httpError(409, WORK_ORDER_CONFLICT_MESSAGE);
    throw error;
  }
}

export { persistOrder as persistWorkOrder };

export async function createWorkOrder(payload) {
  const bike = await Bike.findById(payload.bike);
  if (!bike) throw httpError(404, 'Bicicleta não encontrada');

  const customerId = payload.customer || bike.customer;
  if (String(bike.customer) !== String(customerId)) {
    throw httpError(400, 'A bicicleta não pertence a este cliente');
  }

  const status = payload.status || 'aberta';
  if (isWorkOrderTerminal(status)) {
    throw httpError(400, 'OS nova não pode nascer encerrada');
  }
  assertWorkOrderTransition('aberta', status);

  const order = await WorkOrder.create({
    number: await nextNumber('workOrder', 'OS'),
    customer: customerId,
    bike: bike._id,
    status,
    complaint: payload.complaint || '',
    diagnosis: payload.diagnosis || '',
    mechanic: payload.mechanic || '',
    notes: payload.notes || '',
    discount: assertCents(payload.discount || 0, 'desconto'),
    scheduledAt: payload.scheduledAt || null,
    scheduleKind: payload.scheduleKind || 'servico',
  });

  enqueueJob('os.opened-notice', { orderId: String(order._id) });
  return populateOrder(order._id);
}

export async function addPartToWorkOrder(orderId, { productId, quantity, unitPrice, operator = 'oficina' }) {
  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    assertWorkOrderOpen(order, 'adicionar peça');
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw httpError(400, 'Quantidade da peça deve ser inteira e positiva');
    }

    const product = await Product.findById(productId).session(session || undefined);
    if (!product) throw httpError(404, 'Produto não encontrado');

    const price = unitPrice ?? product.salePrice;
    assertCents(price, 'preço da peça');
    const total = multiplyCents(price, quantity);
    const quoted = isWorkOrderQuoteStatus(order.status);

    let movement = null;
    if (!quoted) {
      ({ movement } = await reserveStock({
        productId: product._id,
        quantity,
        referenceType: 'workOrder',
        referenceId: order._id,
        notes: `Reserva OS ${order.number} — ${product.name}`,
        operator,
        unitCost: product.costPrice,
        unitPrice: price,
        session,
      }));
    }

    order.parts.push({
      product: product._id,
      sku: product.sku,
      name: product.name,
      quantity,
      unitCost: product.costPrice,
      unitPrice: price,
      total,
      stockStatus: quoted ? 'orcamento' : 'reservada',
      stockMovement: movement?._id || null,
    });

    recalcWorkOrder(order);
    await persistOrder(order, session);
  });
  return populateOrder(orderId);
}

export async function removePartFromWorkOrder(orderId, partId, operator = 'oficina') {
  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    assertWorkOrderOpen(order, 'remover peça');

    const part = order.parts.id(partId);
    if (!part) throw httpError(404, 'Peça não encontrada nesta OS');

    if ((part.stockStatus || 'consumida') === 'orcamento') {
      part.deleteOne();
      recalcWorkOrder(order);
      await persistOrder(order, session);
      return;
    }

    if ((part.stockStatus || 'consumida') === 'reservada') {
      await releaseReservation({
        productId: part.product,
        quantity: part.quantity,
        referenceType: 'workOrder',
        referenceId: order._id,
        notes: `Libera reserva OS ${order.number}`,
        operator,
        unitCost: part.unitCost,
        unitPrice: part.unitPrice,
        session,
      });
    } else {
      await applyStockMovement({
        productId: part.product,
        type: 'os_estorno',
        direction: 'entrada',
        quantity: part.quantity,
        referenceType: 'workOrder',
        referenceId: order._id,
        notes: `Estorno de peça da OS ${order.number}`,
        operator,
        unitCost: part.unitCost,
        unitPrice: part.unitPrice,
        session,
      });
    }

    part.deleteOne();
    recalcWorkOrder(order);
    await persistOrder(order, session);
  });
  return populateOrder(orderId);
}

export async function addServiceToWorkOrder(orderId, { serviceId, name, price, quantity = 1 }) {
  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    assertWorkOrderOpen(order, 'adicionar serviço');
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw httpError(400, 'Quantidade do serviço deve ser inteira e positiva');
    }

    let serviceName = name;
    let servicePrice = price;
    let serviceRef = null;

    if (serviceId) {
      const catalog = await Service.findById(serviceId).session(session || undefined);
      if (!catalog) throw httpError(404, 'Serviço não encontrado');
      serviceName = catalog.name;
      servicePrice = price ?? catalog.price;
      serviceRef = catalog._id;
    }

    if (!serviceName) throw httpError(400, 'Informe o nome do serviço');
    assertCents(servicePrice, 'preço do serviço');

    order.services.push({
      service: serviceRef,
      name: serviceName,
      price: servicePrice,
      quantity,
      total: multiplyCents(servicePrice, quantity),
    });

    recalcWorkOrder(order);
    await persistOrder(order, session);
  });
  return populateOrder(orderId);
}

export async function removeServiceFromWorkOrder(orderId, serviceItemId) {
  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    assertWorkOrderOpen(order, 'remover serviço');
    const item = order.services.id(serviceItemId);
    if (!item) throw httpError(404, 'Serviço não encontrado nesta OS');
    item.deleteOne();
    recalcWorkOrder(order);
    await persistOrder(order, session);
  });
  return populateOrder(orderId);
}

export async function updateWorkOrder(orderId, patch, operator = 'oficina') {
  if (patch.status === 'cancelada') {
    return cancelWorkOrder(orderId, operator);
  }

  let becameReady = false;

  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);

    const nextStatus = patch.status;
    const statusChanged = Boolean(nextStatus) && nextStatus !== order.status;
    if (statusChanged) assertWorkOrderTransition(order.status, nextStatus);

    const previousStatus = order.status;
    const allowed = [
      'complaint',
      'diagnosis',
      'mechanic',
      'notes',
      'discount',
      'status',
      'scheduledAt',
      'scheduleKind',
    ];
    for (const key of allowed) {
      if (patch[key] !== undefined) order[key] = patch[key];
    }
    if (patch.scheduledAt === '') order.scheduledAt = null;

    if (statusChanged && nextStatus === 'entregue') {
      recalcWorkOrder(order);
      if (order.paidAmount < order.total) {
        throw httpError(400, 'A OS precisa estar paga para ser entregue');
      }
      order.deliveredAt = new Date();
    }

    if (statusChanged && WORK_ORDER_RESERVE_STATUSES.includes(nextStatus)) {
      await reserveQuotedParts(order, operator, session);
    }

    if (statusChanged && CONSUME_STATUSES.has(nextStatus)) {
      await consumeReservedParts(order, operator, session);
    }

    if (statusChanged && nextStatus === 'aguardando_pecas' && previousStatus !== 'aguardando_pecas') {
      order.partsWaitingSince = new Date();
      order.partsStaleNotifiedAt = null;
    }
    if (statusChanged && nextStatus !== 'aguardando_pecas') {
      order.partsWaitingSince = null;
    }

    if (statusChanged && nextStatus === 'pronta' && !order.readyAt) order.readyAt = new Date();

    recalcWorkOrder(order);
    await persistOrder(order, session);
    becameReady = order.status === 'pronta' && previousStatus !== 'pronta';
  });

  if (becameReady) {
    enqueueJob('os.ready-notice', { orderId: String(orderId) });
  }

  return populateOrder(orderId);
}

export async function consumePartOnWorkOrder(orderId, partId, operator = 'oficina') {
  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    assertWorkOrderOpen(order, 'consumir peça');
    const part = order.parts.id(partId);
    if (!part) throw httpError(404, 'Peça não encontrada nesta OS');
    if ((part.stockStatus || 'consumida') === 'consumida') return;
    if (part.stockStatus === 'orcamento') {
      throw httpError(400, 'Peça ainda no orçamento. Aprove a OS (aguardando peças ou em serviço) para reservar.');
    }

    const { movement } = await consumeReservation({
      productId: part.product,
      quantity: part.quantity,
      referenceType: 'workOrder',
      referenceId: order._id,
      notes: `Consumo OS ${order.number} — ${part.name}`,
      operator,
      unitCost: part.unitCost,
      unitPrice: part.unitPrice,
      session,
    });

    part.stockStatus = 'consumida';
    part.stockMovement = movement._id;
    await persistOrder(order, session);
  });
  return populateOrder(orderId);
}

async function reserveQuotedParts(order, operator, session = null) {
  for (const part of order.parts) {
    if (part.stockStatus !== 'orcamento') continue;
    const { movement } = await reserveStock({
      productId: part.product,
      quantity: part.quantity,
      referenceType: 'workOrder',
      referenceId: order._id,
      notes: `Reserva OS ${order.number} — ${part.name}`,
      operator,
      unitCost: part.unitCost,
      unitPrice: part.unitPrice,
      session,
    });
    part.stockStatus = 'reservada';
    part.stockMovement = movement._id;
  }
}

async function consumeReservedParts(order, operator, session = null) {
  for (const part of order.parts) {
    if ((part.stockStatus || 'consumida') !== 'reservada') continue;
    const { movement } = await consumeReservation({
      productId: part.product,
      quantity: part.quantity,
      referenceType: 'workOrder',
      referenceId: order._id,
      notes: `Consumo OS ${order.number} — ${part.name}`,
      operator,
      unitCost: part.unitCost,
      unitPrice: part.unitPrice,
      session,
    });
    part.stockStatus = 'consumida';
    part.stockMovement = movement._id;
  }
}

export async function addPaymentToWorkOrder(orderId, payment) {
  let becamePaid = false;
  await runInTransaction(async (session) => {
    const order = await loadOrder(orderId, session);
    assertWorkOrderOpen(order, 'registrar pagamento');
    assertCents(payment.amount, 'pagamento da OS');
    const status = payment.status || 'aprovado';
    if (status === 'aprovado') await requireOpenRegister(session);

    recalcWorkOrder(order);
    const beforePaid = order.paidAmount;
    if (status === 'aprovado' && addCents(order.paidAmount, payment.amount) > order.total) {
      throw httpError(400, PAYMENT_EXCEEDS_TOTAL_MESSAGE);
    }

    order.payments.push({
      method: payment.method,
      amount: payment.amount,
      status,
      mercadoPagoId: payment.mercadoPagoId || '',
    });

    recalcWorkOrder(order);
    await persistOrder(order, session);

    if (status === 'aprovado') {
      await registerLedgerMovement({
        type: 'os',
        method: payment.method,
        amount: payment.amount,
        notes: `OS ${order.number}`,
        referenceId: order._id,
        session,
      });
      becamePaid = beforePaid < order.total && order.paidAmount >= order.total && order.total > 0;
    }
  });
  if (becamePaid) enqueueJob('os.paid-notice', { orderId: String(orderId) });
  return populateOrder(orderId);
}

function hasApprovedLedgerPayment(order) {
  return (order.payments || []).some(
    (payment) => (payment.status || 'aprovado') === 'aprovado' && payment.amount > 0,
  );
}

export async function cancelWorkOrder(orderId, operator = 'oficina') {
  await runInTransaction(async (session) => {
    const current = await loadOrder(orderId, session);
    if (current.status === 'cancelada') return;
    if (current.status === 'entregue') throw httpError(400, 'OS entregue não pode ser cancelada');

    const needsReversal = hasApprovedLedgerPayment(current);
    if (needsReversal) await requireOpenRegister(session);

    for (const part of current.parts) {
      if ((part.stockStatus || 'consumida') === 'orcamento') continue;
      if ((part.stockStatus || 'consumida') === 'reservada') {
        await releaseReservation({
          productId: part.product,
          quantity: part.quantity,
          referenceType: 'workOrder',
          referenceId: current._id,
          notes: `Cancelamento OS ${current.number} — libera reserva`,
          operator,
          unitCost: part.unitCost,
          unitPrice: part.unitPrice,
          session,
        });
        continue;
      }
      await applyStockMovement({
        productId: part.product,
        type: 'os_estorno',
        direction: 'entrada',
        quantity: part.quantity,
        referenceType: 'workOrder',
        referenceId: current._id,
        notes: `Cancelamento da OS ${current.number}`,
        operator,
        unitCost: part.unitCost,
        unitPrice: part.unitPrice,
        session,
      });
    }

    current.status = 'cancelada';
    await persistOrder(current, session);

    if (needsReversal) await reverseLedgerForReference(current._id, session);
  });

  const cancelled = await populateOrder(orderId);
  if (hasApprovedLedgerPayment(cancelled)) {
    await recordAudit({
      action: 'workOrder.cancelled_paid',
      actor: { login: operator },
      meta: { orderId: String(orderId), number: cancelled.number, paidAmount: cancelled.paidAmount },
    });
  }
  return cancelled;
}

export async function listWorkOrderBoard({ limit = 40 } = {}) {
  const cap = listLimit(limit, 40);
  const [countRows, ...lists] = await Promise.all([
    WorkOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ...WORK_ORDER_KANBAN_STATUSES.map((status) =>
      WorkOrder.find({ status })
        .populate('customer')
        .populate('bike')
        .sort({ updatedAt: -1 })
        .limit(cap),
    ),
  ]);

  const counts = {};
  for (const status of WORK_ORDER_KANBAN_STATUSES) counts[status] = 0;
  for (const row of countRows) counts[row._id] = row.count;

  const columns = {};
  WORK_ORDER_KANBAN_STATUSES.forEach((status, index) => {
    columns[status] = lists[index];
  });

  return { counts, columns };
}

export async function workshopStatusCounts() {
  const rows = await WorkOrder.aggregate([
    { $match: { status: { $nin: ['entregue', 'cancelada'] } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const statusCount = {
    aberta: 0,
    diagnostico: 0,
    orcamento: 0,
    aguardando_pecas: 0,
    em_servico: 0,
    pronta: 0,
  };
  let openOrderCount = 0;
  for (const row of rows) {
    if (statusCount[row._id] !== undefined) statusCount[row._id] = row.count;
    openOrderCount += row.count;
  }
  return { statusCount, openOrderCount };
}

export async function listStaleWaitingParts(days = 3) {
  const waitDays = Math.min(Math.max(Number(days) || 3, 1), 30);
  const cutoff = new Date(Date.now() - waitDays * 24 * 60 * 60 * 1000);
  return WorkOrder.find({
    status: 'aguardando_pecas',
    $or: [{ partsWaitingSince: { $lte: cutoff } }, { partsWaitingSince: null, updatedAt: { $lte: cutoff } }],
  })
    .populate('customer')
    .populate('bike')
    .sort({ partsWaitingSince: 1, updatedAt: 1 })
    .limit(80);
}

export function populateOrder(id) {
  return WorkOrder.findById(id).populate('customer').populate('bike');
}
