import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pos } from './Pos';
import type { Product } from '../types';

const get = vi.fn();
const post = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
}));

const product: Product = {
  _id: 'p1',
  sku: 'COR-01',
  barcode: '789',
  name: 'Corrente SRAM',
  description: '',
  category: 'Transmissão',
  brand: 'SRAM',
  model: '',
  unit: 'UN',
  costPrice: 8000,
  salePrice: 15990,
  currentStock: 3,
  availableStock: 3,
  minStock: 1,
  location: '',
  active: true,
  images: [],
};

describe('PDV', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/customers') return [];
      if (path === '/cash/current') return { _id: 'caixa1', status: 'aberto', expectedCash: 0 };
      if (path.startsWith('/products?')) return [product];
      if (path.includes('/receipt')) {
        return {
          text: 'CUPOM',
          escposBase64: '',
          width: 80,
          store: { name: 'BikeGer', phone: '', address: '', cnpj: '' },
        };
      }
      return [];
    });
  });

  it('adiciona peça, mostra total e finaliza a venda', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ _id: 'sale1' });
    render(<Pos />);

    await user.type(screen.getByPlaceholderText('SKU, código ou nome'), 'corrente');
    const add = await screen.findByRole('button', { name: 'Adicionar' });
    await user.click(add);

    expect(screen.getByText('Corrente SRAM')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 159,90').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Finalizar e imprimir' }));

    expect(post).toHaveBeenCalledWith(
      '/sales',
      expect.objectContaining({
        items: [{ product: 'p1', quantity: 1, unitPrice: 15990 }],
      }),
    );
  });

  it('não finaliza com o caixa fechado', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/customers') return [];
      if (path === '/cash/current') return null;
      if (path.startsWith('/products?')) return [product];
      return [];
    });
    render(<Pos />);

    expect(await screen.findByText(/abra o caixa para finalizar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar e imprimir' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('não dispara duas vendas no clique duplo', async () => {
    const user = userEvent.setup();
    let resolveSale: ((value: { _id: string }) => void) | undefined;
    post.mockImplementation((path: string) => {
      if (path === '/sales') {
        return new Promise<{ _id: string }>((resolve) => {
          resolveSale = resolve;
        });
      }
      return Promise.resolve({});
    });
    render(<Pos />);

    await user.type(screen.getByPlaceholderText('SKU, código ou nome'), 'corrente');
    await user.click(await screen.findByRole('button', { name: 'Adicionar' }));

    const finish = screen.getByRole('button', { name: 'Finalizar e imprimir' });
    fireEvent.click(finish);
    fireEvent.click(finish);

    expect(post.mock.calls.filter((call) => call[0] === '/sales')).toHaveLength(1);
    expect(finish).toBeDisabled();
    resolveSale?.({ _id: 'sale1' });
    expect(await screen.findByText('CUPOM')).toBeInTheDocument();
  });
});
