import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedWorkOrderStatuses,
  assertWorkOrderTransition,
  canTransitionWorkOrder,
  isWorkOrderTerminal,
} from '../src/utils/workOrderStatus.js';

test('oficina pode pular etapa e voltar enquanto a OS está aberta', () => {
  assert.equal(canTransitionWorkOrder('aberta', 'em_servico'), true);
  assert.equal(canTransitionWorkOrder('aberta', 'pronta'), true);
  assert.equal(canTransitionWorkOrder('pronta', 'em_servico'), true);
  assert.equal(canTransitionWorkOrder('diagnostico', 'aguardando_pecas'), true);
  assert.equal(canTransitionWorkOrder('pronta', 'entregue'), true);
  assert.equal(canTransitionWorkOrder('em_servico', 'cancelada'), true);
  assert.equal(canTransitionWorkOrder('pronta', 'pronta'), true);
});

test('entregue e cancelada são estados finais', () => {
  assert.equal(isWorkOrderTerminal('entregue'), true);
  assert.equal(isWorkOrderTerminal('cancelada'), true);
  assert.equal(isWorkOrderTerminal('pronta'), false);
  assert.equal(canTransitionWorkOrder('entregue', 'aberta'), false);
  assert.equal(canTransitionWorkOrder('entregue', 'pronta'), false);
  assert.equal(canTransitionWorkOrder('cancelada', 'em_servico'), false);
  assert.equal(canTransitionWorkOrder('cancelada', 'entregue'), false);
  assert.deepEqual(allowedWorkOrderStatuses('entregue'), ['entregue']);
  assert.ok(allowedWorkOrderStatuses('aberta').includes('cancelada'));
});

test('assert da transição fala a língua da oficina', () => {
  assert.doesNotThrow(() => assertWorkOrderTransition('aberta', 'diagnostico'));
  assert.throws(() => assertWorkOrderTransition('entregue', 'aberta'), /OS entregue não pode mudar de status/);
  assert.throws(() => assertWorkOrderTransition('cancelada', 'pronta'), /OS cancelada não pode mudar de status/);
});
