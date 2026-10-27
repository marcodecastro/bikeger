import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Reports } from './Reports';
import type { MonthReport } from '../types';

const get = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
}));

const report: MonthReport = {
  year: 2026,
  month: 10,
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-11-01T00:00:00.000Z',
  sales: { count: 2, revenue: 34990, cost: 10000, margin: 24990 },
  workshop: {
    opened: 3,
    delivered: 1,
    revenue: 15000,
    openNow: 2,
    byStatus: { aberta: 1 },
  },
  stock: { skuCount: 10, units: 40, value: 80000, outQty: 5, giro: 1.5 },
  purchases: { count: 1, total: 20000 },
};

describe('Relatório', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue(report);
  });

  it('oferece CSV e impressão quando o mês carrega', async () => {
    render(<Reports />);
    expect(await screen.findByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Imprimir / PDF' })).toBeEnabled();
  });
});
