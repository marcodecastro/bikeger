export const ROLES = ['dono', 'balcao', 'mecanico'];

export const ROLE_LABELS = {
  dono: 'Dono',
  balcao: 'Balcão',
  mecanico: 'Mecânico',
};

const CAPS = {
  dono: ['*'],
  balcao: [
    'dashboard',
    'pos',
    'sales',
    'workshop',
    'agenda',
    'products.read',
    'stock.read',
    'customers',
    'bikes',
    'services.read',
    'cash',
    'payments',
    'search',
  ],
  mecanico: [
    'dashboard',
    'workshop',
    'agenda',
    'products.read',
    'stock.read',
    'customers.read',
    'bikes',
    'services.read',
    'search',
  ],
};

export function capabilitiesFor(role) {
  if (role === 'dono') return ['*'];
  return [...(CAPS[role] || [])];
}

export function can(role, capability) {
  if (!role || !capability) return false;
  const granted = capabilitiesFor(role);
  if (granted.includes('*')) return true;
  if (granted.includes(capability)) return true;
  if (capability.endsWith('.read')) {
    const base = capability.slice(0, -5);
    if (granted.includes(base)) return true;
  }
  return false;
}
