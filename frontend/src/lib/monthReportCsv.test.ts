import { describe, expect, it } from 'vitest';
import { monthReportCsv, monthReportFileName } from './monthReportCsv';
import type { MonthReport } from '../types';

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
    byStatus: { aberta: 1, pronta: 1 },
  },
  stock: { skuCount: 10, units: 40, value: 80000, outQty: 5, giro: 1.5 },
  purchases: { count: 1, total: 20000 },
};

describe('CSV do relatório', () => {
  it('gera arquivo do mês com BOM e indicadores', () => {
    expect(monthReportFileName(report)).toBe('bikeger-relatorio-2026-10.csv');
    const csv = monthReportCsv(report);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Vendas pagas;R$ 349,90;2 cupons');
    expect(csv).toContain('Pronta;1');
    expect(csv).toContain('giro 1.50');
  });
});
