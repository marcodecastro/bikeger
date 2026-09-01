import { can } from './roles.js';

const COST_FIELDS = new Set(['costPrice', 'unitCost']);

export function canSeeCost(user) {
  return can(user?.role, 'sales');
}

export function hideCostIfNeeded(value, user) {
  if (canSeeCost(user)) return value;
  return stripCost(value);
}

export function stripCost(value) {
  if (value == null) return value;
  const plain = typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
  removeCostFields(plain);
  return plain;
}

function removeCostFields(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) removeCostFields(item);
    return;
  }
  for (const key of COST_FIELDS) delete node[key];
  for (const child of Object.values(node)) removeCostFields(child);
}
