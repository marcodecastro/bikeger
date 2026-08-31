import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import type { DashboardData } from '../types';

const get = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

const data: DashboardData = {
  today: { salesCount: 2, revenue: 10000, estimatedProfit: 4000 },
  customers: 3,
  lowStock: [],
  openOrders: [],
  workshop: { pronta: 0 },
  register: null,
  recentSales: [],
  recentOrders: [],
  marginByCategory: [{ category: 'Transmissão', quantity: 1, revenue: 10000, cost: 4000, profit: 6000 }],
  monthMarginByCategory: [
    { category: 'Transmissão', quantity: 1, revenue: 10000, cost: 4000, profit: 6000 },
  ],
};

describe('Painel', () => {
  beforeEach(() => {
    get.mockReset();
    can.mockReset();
    get.mockResolvedValue(data);
  });

  it('esconde margem e custo do mecânico', async () => {
    can.mockImplementation((capability: string) => capability !== 'sales' && capability !== 'pos');
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Painel da loja')).toBeInTheDocument();
    expect(screen.queryByText('Margem estimada')).not.toBeInTheDocument();
    expect(screen.queryByText('Custo')).not.toBeInTheDocument();
    expect(screen.queryByText('Margem por categoria — este mês')).not.toBeInTheDocument();
    expect(screen.getByText('Seu turno')).toBeInTheDocument();
  });

  it('mostra margem e custo para quem vende', async () => {
    can.mockReturnValue(true);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Margem estimada')).toBeInTheDocument();
    expect(screen.getByText('Custo')).toBeInTheDocument();
    expect(screen.getByText('Margem por categoria — este mês')).toBeInTheDocument();
  });
});
