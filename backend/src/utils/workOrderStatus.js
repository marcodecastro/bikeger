import { WORK_ORDER_STATUSES } from '../models/WorkOrder.js';
import { httpError } from './asyncHandler.js';

export const WORK_ORDER_FLOW = [
  'aberta',
  'diagnostico',
  'orcamento',
  'aguardando_pecas',
  'em_servico',
  'pronta',
  'entregue',
];

export const WORK_ORDER_QUOTE_STATUSES = ['diagnostico', 'orcamento'];

export const WORK_ORDER_RESERVE_STATUSES = ['aguardando_pecas', 'em_servico', 'pronta', 'entregue'];

export function isWorkOrderQuoteStatus(status) {
  return WORK_ORDER_QUOTE_STATUSES.includes(status);
}

export const WORK_ORDER_TERMINAL_STATUSES = ['entregue', 'cancelada'];

export const WORK_ORDER_OPEN_STATUSES = WORK_ORDER_STATUSES.filter(
  (status) => !WORK_ORDER_TERMINAL_STATUSES.includes(status),
);

export const WORK_ORDER_KANBAN_STATUSES = [...WORK_ORDER_OPEN_STATUSES, 'cancelada'];

export function isWorkOrderTerminal(status) {
  return WORK_ORDER_TERMINAL_STATUSES.includes(status);
}

export function canTransitionWorkOrder(from, to) {
  if (!to || from === to) return true;
  if (isWorkOrderTerminal(from)) return false;
  if (to === 'cancelada') return true;
  if (to === 'entregue') return from === 'pronta';
  return WORK_ORDER_OPEN_STATUSES.includes(to);
}

export function allowedWorkOrderStatuses(from) {
  if (isWorkOrderTerminal(from)) return [from];
  const next = [...WORK_ORDER_OPEN_STATUSES, 'cancelada'];
  if (from === 'pronta') next.push('entregue');
  return next;
}

export function assertWorkOrderTransition(from, to) {
  if (canTransitionWorkOrder(from, to)) return;
  if (from === 'entregue') throw httpError(400, 'OS entregue não pode mudar de status');
  if (from === 'cancelada') throw httpError(400, 'OS cancelada não pode mudar de status');
  if (to === 'entregue') throw httpError(400, 'Só dá para entregar a OS quando ela está pronta');
  throw httpError(400, `Não é possível mudar a OS de ${from} para ${to}`);
}

export function assertWorkOrderOpen(order, action = 'alterar') {
  if (!isWorkOrderTerminal(order.status)) return;
  throw httpError(400, `Não é possível ${action} em OS encerrada`);
}
