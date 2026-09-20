import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerDetail } from './CustomerDetail';
import type { CustomerHistory } from '../types';

const get = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

const customer = {
  _id: 'c1',
  name: 'Ana',
  phone: '11',
  email: 'ana@loja.test',
  document: '',
  notes: '',
  active: true,
};

function history(overrides: Partial<CustomerHistory> = {}): CustomerHistory {
  return {
    customer,
    bikes: [],
    sales: [
      {
        _id: 's1',
        number: 'VD-1',
        createdAt: '2026-09-01T12:00:00.000Z',
        total: 10000,
      } as CustomerHistory['sales'][number],
    ],
    orders: [
      {
        _id: 'o1',
        number: 'OS-1',
        status: 'aberta',
        total: 5000,
      } as CustomerHistory['orders'][number],
    ],
    lifetimeValue: 80000,
    salesTotal: 50000,
    ordersTotal: 30000,
    visitCount: 4,
    salesCount: 3,
    ordersCount: 2,
    salesHasMore: true,
    ordersHasMore: true,
    ...overrides,
  };
}

describe('Ficha do cliente', () => {
  beforeEach(() => {
    get.mockReset();
    can.mockReset();
    can.mockReturnValue(true);
    get.mockResolvedValueOnce(history()).mockResolvedValueOnce(
      history({
        sales: [
          {
            _id: 's1',
            number: 'VD-1',
            createdAt: '2026-09-01T12:00:00.000Z',
            total: 10000,
          } as CustomerHistory['sales'][number],
          {
            _id: 's2',
            number: 'VD-2',
            createdAt: '2026-08-01T12:00:00.000Z',
            total: 20000,
          } as CustomerHistory['sales'][number],
        ],
        salesHasMore: false,
      }),
    );
  });

  it('mantém os totais e pede a próxima página de compras', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/clientes/c1']}>
        <Routes>
          <Route path="/clientes/:id" element={<CustomerDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('R$ 800,00')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/customers/c1?salesLimit=50&ordersLimit=50');

    await user.click(screen.getByRole('button', { name: 'Ver mais compras' }));
    expect(get).toHaveBeenCalledWith('/customers/c1?salesLimit=51&ordersLimit=50');
    expect(await screen.findByText('VD-2')).toBeInTheDocument();
  });

  it('mostra o erro quando a ficha não carrega', async () => {
    get.mockReset();
    get.mockRejectedValue(new Error('Cliente não encontrado'));
    render(
      <MemoryRouter initialEntries={['/clientes/c1']}>
        <Routes>
          <Route path="/clientes/:id" element={<CustomerDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Cliente não encontrado');
    expect(screen.queryByText('Carregando ficha...')).not.toBeInTheDocument();
  });
});
