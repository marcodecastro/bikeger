import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, capabilitiesFor } from '../src/utils/roles.js';

test('dono recebe * e passa em qualquer capability', () => {
  assert.deepEqual(capabilitiesFor('dono'), ['*']);
  assert.equal(can('dono', 'settings'), true);
  assert.equal(can('dono', 'products.write'), true);
  assert.equal(can('dono', 'cash'), true);
});

test('balcão vende e escreve cliente, mas não mexe em equipe', () => {
  assert.equal(can('balcao', 'sales'), true);
  assert.equal(can('balcao', 'customers'), true);
  assert.equal(can('balcao', 'customers.read'), true);
  assert.equal(can('balcao', 'products.read'), true);
  assert.equal(can('balcao', 'products.write'), false);
  assert.equal(can('balcao', 'users'), false);
  assert.equal(can('balcao', 'settings'), false);
});

test('mecânico lê oficina e não vê venda nem custo', () => {
  assert.equal(can('mecanico', 'workshop'), true);
  assert.equal(can('mecanico', 'agenda'), true);
  assert.equal(can('mecanico', 'customers.read'), true);
  assert.equal(can('mecanico', 'customers'), false);
  assert.equal(can('mecanico', 'sales'), false);
  assert.equal(can('mecanico', 'payments'), false);
});
