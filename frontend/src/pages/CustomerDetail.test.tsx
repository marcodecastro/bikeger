import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerDetail } from './CustomerDetail';
import type { CustomerHistory } from '../types';

const get = vi.fn();
const put = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
  put: (...args: unknown[]) => put(...args),
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
    put.mockReset();
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

  it('salva nome, telefone e CPF na ficha', async () => {
    const user = userEvent.setup();
    put.mockResolvedValue({
      ...customer,
      name: 'Ana Lima',
      phone: '11999990000',
      document: '39053344705',
    });
    render(
      <MemoryRouter initialEntries={['/clientes/c1']}>
        <Routes>
          <Route path="/clientes/:id" element={<CustomerDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Nome')).toHaveValue('Ana');
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Ana Lima');
    await user.clear(screen.getByLabelText('Telefone'));
    await user.type(screen.getByLabelText('Telefone'), '11999990000');
    await user.type(screen.getByLabelText('CPF'), '39053344705');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(put).toHaveBeenCalledWith(
      '/customers/c1',
      expect.objectContaining({
        name: 'Ana Lima',
        phone: '11999990000',
        document: '39053344705',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Cadastro atualizado.');
  });

  it('salva o endereço usado na NFC-e', async () => {
    const user = userEvent.setup();
    put.mockResolvedValue({
      ...customer,
      address: {
        street: 'Rua das Bicicletas',
        number: '100',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zip: '01310100',
      },
    });
    render(
      <MemoryRouter initialEntries={['/clientes/c1']}>
        <Routes>
          <Route path="/clientes/:id" element={<CustomerDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText('Rua'), 'Rua das Bicicletas');
    await user.type(screen.getByLabelText('Número'), '100');
    await user.type(screen.getByLabelText('Bairro'), 'Centro');
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo');
    await user.selectOptions(screen.getByLabelText('UF'), 'SP');
    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(put).toHaveBeenCalledWith(
      '/customers/c1',
      expect.objectContaining({
        address: {
          street: 'Rua das Bicicletas',
          number: '100',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zip: '01310100',
        },
      }),
    );
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
