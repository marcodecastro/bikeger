import { describe, expect, it } from 'vitest';
import { can } from './permissions';

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
    expect(can('mecanico', 'payments')).toBe(false);
  });
});
