import ROLE_CAPABILITIES from '../../../shared/role-capabilities.json' with { type: 'json' };

export const ROLES = ['dono', 'balcao', 'mecanico'];

export const ROLE_LABELS = {
  dono: 'Dono',
  balcao: 'Balcão',
  mecanico: 'Mecânico',
};

export const ROLE_CAPABILITIES_CONTRACT = ROLE_CAPABILITIES;

export function capabilitiesFor(role) {
  if (role === 'dono') return ['*'];
  return [...(ROLE_CAPABILITIES[role] || [])];
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
