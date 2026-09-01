import { WorkOrder } from '../models/WorkOrder.js';
import { Product } from '../models/Product.js';
import { Service } from '../models/Service.js';
import { Bike } from '../models/Bike.js';
import { nextNumber } from '../utils/ids.js';
import { addCents, assertCents, multiplyCents, subtractCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { applyStockMovement, consumeReservation, releaseReservation, reserveStock } from './stockService.js';
import { registerLedgerMovement, requireOpenRegister, reverseLedgerForReference } from './cashService.js';
import { enqueueReadyNotice } from './notifyService.js';
import { runInTransaction } from '../utils/transaction.js';
import { assertWorkOrderOpen, assertWorkOrderTransition, isWorkOrderTerminal } from '../utils/workOrderStatus.js';

const CONSUME_STATUSES = new Set(['em_servico', 'pronta', 'entregue']);

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

  return WorkOrder.findById(order._id).populate('customer').populate('bike');
}

export async function addPartToWorkOrder(orderId, { productId, quantity, unitPrice, operator = 'oficina' }) {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  assertWorkOrderOpen(order, 'adicionar peça');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'Quantidade da peça deve ser inteira e positiva');
  }

  const product = await Product.findById(productId);
  if (!product) throw httpError(404, 'Produto não encontrado');

  const price = unitPrice ?? product.salePrice;
  assertCents(price, 'preço da peça');
  const total = multiplyCents(price, quantity);

  const { movement } = await reserveStock({
    productId: product._id,
    quantity,
    referenceType: 'workOrder',
    referenceId: order._id,
    notes: `Reserva OS ${order.number} — ${product.name}`,
    operator,
    unitCost: product.costPrice,
    unitPrice: price,
  });

  order.parts.push({
    product: product._id,
    sku: product.sku,
    name: product.name,
    quantity,
    unitCost: product.costPrice,
    unitPrice: price,
    total,
    stockStatus: 'reservada',
    stockMovement: movement._id,
  });

  recalcWorkOrder(order);
  await order.save();
  return populateOrder(order._id);
}

export async function removePartFromWorkOrder(orderId, partId, operator = 'oficina') {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  assertWorkOrderOpen(order, 'remover peça');

  const part = order.parts.id(partId);
  if (!part) throw httpError(404, 'Peça não encontrada nesta OS');

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
    });
  }

  part.deleteOne();
  recalcWorkOrder(order);
  await order.save();
  return populateOrder(order._id);
}

export async function addServiceToWorkOrder(orderId, { serviceId, name, price, quantity = 1 }) {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  assertWorkOrderOpen(order, 'adicionar serviço');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'Quantidade do serviço deve ser inteira e positiva');
  }

  let serviceName = name;
  let servicePrice = price;
  let serviceRef = null;

  if (serviceId) {
    const catalog = await Service.findById(serviceId);
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
  await order.save();
  return populateOrder(order._id);
}

export async function removeServiceFromWorkOrder(orderId, serviceItemId) {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  assertWorkOrderOpen(order, 'remover serviço');
  const item = order.services.id(serviceItemId);
  if (!item) throw httpError(404, 'Serviço não encontrado nesta OS');
  item.deleteOne();
  recalcWorkOrder(order);
  await order.save();
  return populateOrder(order._id);
}

export async function updateWorkOrder(orderId, patch, operator = 'oficina') {
  if (patch.status === 'cancelada') {
    return cancelWorkOrder(orderId, operator);
  }

  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');

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
    if (order.paidAmount < order.total) {
      throw httpError(400, 'A OS precisa estar paga para ser entregue');
    }
    order.deliveredAt = new Date();
  }

  if (statusChanged && CONSUME_STATUSES.has(nextStatus)) {
    await consumeReservedParts(order, operator);
  }

  if (statusChanged && nextStatus === 'pronta' && !order.readyAt) order.readyAt = new Date();

  recalcWorkOrder(order);
  await order.save();

  if (order.status === 'pronta' && previousStatus !== 'pronta') {
    await enqueueReadyNotice(order._id).catch((error) => {
      console.error('Aviso OS pronta:', error.message);
    });
  }

  return populateOrder(order._id);
}

export async function consumePartOnWorkOrder(orderId, partId, operator = 'oficina') {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  assertWorkOrderOpen(order, 'consumir peça');
  const part = order.parts.id(partId);
  if (!part) throw httpError(404, 'Peça não encontrada nesta OS');
  if ((part.stockStatus || 'consumida') === 'consumida') return populateOrder(order._id);

  const { movement } = await consumeReservation({
    productId: part.product,
    quantity: part.quantity,
    referenceType: 'workOrder',
    referenceId: order._id,
    notes: `Consumo OS ${order.number} — ${part.name}`,
    operator,
    unitCost: part.unitCost,
    unitPrice: part.unitPrice,
  });

  part.stockStatus = 'consumida';
  part.stockMovement = movement._id;
  await order.save();
  return populateOrder(order._id);
}

async function consumeReservedParts(order, operator) {
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
    });
    part.stockStatus = 'consumida';
    part.stockMovement = movement._id;
  }
}

export async function addPaymentToWorkOrder(orderId, payment) {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  assertWorkOrderOpen(order, 'registrar pagamento');
  assertCents(payment.amount, 'pagamento da OS');
  if ((payment.status || 'aprovado') === 'aprovado') await requireOpenRegister();

  order.payments.push({
    method: payment.method,
    amount: payment.amount,
    status: payment.status || 'aprovado',
    mercadoPagoId: payment.mercadoPagoId || '',
  });

  recalcWorkOrder(order);
  await order.save();

  if ((payment.status || 'aprovado') === 'aprovado') {
    await registerLedgerMovement({
      type: 'os',
      method: payment.method,
      amount: payment.amount,
      notes: `OS ${order.number}`,
      referenceId: order._id,
    });
  }

  return populateOrder(order._id);
}

function hasApprovedLedgerPayment(order) {
  return (order.payments || []).some(
    (payment) => (payment.status || 'aprovado') === 'aprovado' && payment.amount > 0,
  );
}

export async function cancelWorkOrder(orderId, operator = 'oficina') {
  const order = await runInTransaction(async (session) => {
    const current = await WorkOrder.findById(orderId).session(session || undefined);
    if (!current) throw httpError(404, 'OS não encontrada');
    if (current.status === 'cancelada') return current;
    if (current.status === 'entregue') throw httpError(400, 'OS entregue não pode ser cancelada');

    const needsReversal = hasApprovedLedgerPayment(current);
    if (needsReversal) await requireOpenRegister(session);

    for (const part of current.parts) {
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
    await current.save({ session: session || undefined });

    if (needsReversal) await reverseLedgerForReference(current._id, session);
    return current;
  });

  return populateOrder(order._id);
}

export function populateOrder(id) {
  return WorkOrder.findById(id).populate('customer').populate('bike');
}
