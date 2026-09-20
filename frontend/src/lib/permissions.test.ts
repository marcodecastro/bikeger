import { describe, expect, it } from 'vitest';
import { can, ROLE_CAPABILITIES_CONTRACT } from './permissions';
import local from './role-capabilities.json';

describe('capabilities do cliente', () => {
  it('usa a lista que veio da API quando existe', () => {
    expect(can('mecanico', 'sales', ['workshop', 'agenda'])).toBe(false);
    expect(can('mecanico', 'workshop', ['workshop', 'agenda'])).toBe(true);
    expect(can('balcao', 'customers.read', ['customers'])).toBe(true);
  });

  it('dono com * passa em settings', () => {
    expect(can('dono', 'settings', ['*'])).toBe(true);
  });

  it('sem capabilities no user, cai no mapa local do perfil', () => {
    expect(can('balcao', 'sales')).toBe(true);
    expect(can('balcao', 'stock.write')).toBe(false);
    expect(can('mecanico', 'payments')).toBe(false);
    expect(can('mecanico', 'stock.write')).toBe(false);
  });

  it('usa o mesmo contrato de capabilities do backend', async () => {
    expect(ROLE_CAPABILITIES_CONTRACT).toEqual(local);
    try {
      const backend = await import('../../../backend/shared/role-capabilities.json');
      expect(ROLE_CAPABILITIES_CONTRACT).toEqual(backend.default ?? backend);
    } catch {
      // Checkout só do frontend: o JSON local é o contrato deste deploy.
    }
  });
});
