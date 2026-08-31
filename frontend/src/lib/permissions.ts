export type Role = 'dono' | 'balcao' | 'mecanico';

export const ROLE_LABELS: Record<Role, string> = {
  dono: 'Dono',
  balcao: 'Balcão',
  mecanico: 'Mecânico',
};

export const ROLE_BLURBS: Record<Role, string> = {
  dono: 'Caixa, estoque, equipe e o negócio inteiro.',
  balcao: 'PDV, clientes, recebimento e abertura de OS.',
  mecanico: 'Oficina, peças na OS e histórico da bike.',
};

const CAPS: Record<Role, string[]> = {
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

export function capabilitiesFor(role: Role | undefined): string[] {
  if (!role) return [];
  if (role === 'dono') return ['*'];
  return [...(CAPS[role] || [])];
}

export function can(role: Role | undefined, capability: string, granted?: string[]): boolean {
  if (!capability) return false;
  const list = granted?.length ? granted : capabilitiesFor(role);
  if (!list.length) return false;
  if (list.includes('*')) return true;
  if (list.includes(capability)) return true;
  if (capability.endsWith('.read')) {
    const base = capability.slice(0, -5);
    if (list.includes(base)) return true;
  }
  return false;
}

export function homeFor(role: Role): string {
  if (role === 'balcao') return '/pdv';
  if (role === 'mecanico') return '/oficina';
  return '/';
}

export interface AuthUser {
  id: string;
  name: string;
  login: string;
  role: Role;
  active: boolean;
  capabilities?: string[];
}
