import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import type { DashboardData } from '../types';

const get = vi.fn();
const post = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
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
    post.mockReset();
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
    expect(screen.getByText(/Orçamento não reserva peça/)).toBeInTheDocument();
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

  it('lista OS parada em aguardando peças', async () => {
    can.mockReturnValue(true);
    get.mockResolvedValue({
      ...data,
      waitingPartsDays: 3,
      waitingParts: [
        {
          _id: 'os-wait',
          number: 'OS-00015',
          status: 'aguardando_pecas',
          customer: { _id: 'c1', name: 'Maria', phone: '', email: '', document: '', active: true },
          bike: {
            _id: 'b1',
            customer: 'c1',
            brand: 'Caloi',
            model: 'Elite',
            color: '',
            serialNumber: '',
            frameSize: '',
            type: 'mtb',
            notes: '',
          },
        },
      ],
    });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('OS parada — aguardando peças')).toBeInTheDocument();
    expect(screen.getByText('OS-00015')).toBeInTheDocument();
    expect(screen.getByText(/Há 3 dia\(s\) ou mais/)).toBeInTheDocument();
  });

  it('mostra botão para reaplicar PIX pendente', async () => {
    can.mockReturnValue(true);
    get.mockResolvedValue({ ...data, pendingApplyCount: 2 });
    post.mockResolvedValue({ ok: 2, fail: 0 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/PIX pago sem baixa no livro/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(post).toHaveBeenCalledWith('/payments/outbox/retry');
  });
});
