import { describe, expect, it } from 'vitest';
import { dayEndIso, dayStartIso, LIST_PAGE, pageHasMore, pagedPath } from './listPage';

describe('paginação das listas', () => {
  it('monta limit e skip na query', () => {
    expect(pagedPath('/sales', 0)).toBe('/sales?limit=50&skip=0');
    expect(pagedPath('/products', 50, { q: 'cor' })).toBe('/products?q=cor&limit=50&skip=50');
  });

  it('converte o dia do filtro para ISO', () => {
    expect(dayStartIso('')).toBe('');
    expect(dayStartIso('2026-10-01')).toBe(new Date('2026-10-01T00:00:00').toISOString());
    expect(dayEndIso('2026-10-01')).toBe(new Date('2026-10-01T23:59:59.999').toISOString());
  });

  it('só oferece a próxima página quando o lote veio cheio', () => {
    expect(pageHasMore(Array.from({ length: LIST_PAGE }, (_, i) => i))).toBe(true);
    expect(pageHasMore([1])).toBe(false);
  });
});
