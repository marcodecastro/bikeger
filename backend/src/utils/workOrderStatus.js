import { WORK_ORDER_STATUSES } from '../models/WorkOrder.js';
import { httpError } from './asyncHandler.js';

export const WORK_ORDER_TERMINAL_STATUSES = ['entregue', 'cancelada'];

export const WORK_ORDER_OPEN_STATUSES = WORK_ORDER_STATUSES.filter(
  (status) => !WORK_ORDER_TERMINAL_STATUSES.includes(status),
);

export function isWorkOrderTerminal(status) {
  return WORK_ORDER_TERMINAL_STATUSES.includes(status);
}

export function canTransitionWorkOrder(from, to) {
  if (!to || from === to) return true;
  if (isWorkOrderTerminal(from)) return false;
  return WORK_ORDER_STATUSES.includes(to);
}

export function allowedWorkOrderStatuses(from) {
  if (isWorkOrderTerminal(from)) return [from];
  return [...WORK_ORDER_STATUSES];
}

export function assertWorkOrderTransition(from, to) {
  if (canTransitionWorkOrder(from, to)) return;
  if (from === 'entregue') throw httpError(400, 'OS entregue não pode mudar de status');
  if (from === 'cancelada') throw httpError(400, 'OS cancelada não pode mudar de status');
  throw httpError(400, `Não é possível mudar a OS de ${from} para ${to}`);
}

export function assertWorkOrderOpen(order, action = 'alterar') {
  if (!isWorkOrderTerminal(order.status)) return;
  throw httpError(400, `Não é possível ${action} em OS encerrada`);
}
