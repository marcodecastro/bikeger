import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Purchases } from './Purchases';

const get = vi.fn();
const post = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
}));

describe('Compras', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/purchases' || String(path).startsWith('/purchases?')) return [];
      if (path === '/purchases/needed' || String(path).startsWith('/purchases/needed?')) {
        return [
          {
            productId: 'p1',
            sku: 'COR-01',
            name: 'Corrente SRAM',
            quantity: 2,
            unitCost: 8000,
            currentStock: 0,
            supplierId: 's1',
            supplierName: 'Shimano Dist',
            orders: ['OS-00015'],
          },
        ];
      }
      if (path === '/suppliers') return [{ _id: 's1', name: 'Shimano Dist' }];
      if (path.includes('/products/lookup/COR-01')) {
        return { _id: 'p1', name: 'Corrente SRAM', sku: 'COR-01', costPrice: 8000, currentStock: 3 };
      }
      throw new Error('Peça não encontrada');
    });
  });

  it('inclui a peça no lote com Enter no código', async () => {
    render(
      <MemoryRouter>
        <Purchases />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Nenhuma compra ainda.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Código de barras ou SKU'), { target: { value: 'COR-01' } });
    fireEvent.submit(screen.getByLabelText('Código de barras ou SKU').closest('form') as HTMLFormElement);

    expect(await screen.findByText(/1x Corrente SRAM/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/products/lookup/COR-01');
  });

  it('soma quantidade no segundo bipe da mesma peça', async () => {
    render(
      <MemoryRouter>
        <Purchases />
      </MemoryRouter>,
    );
    await screen.findByText('Nenhuma compra ainda.');
    const input = screen.getByLabelText('Código de barras ou SKU');
    const form = input.closest('form') as HTMLFormElement;

    fireEvent.change(input, { target: { value: 'COR-01' } });
    fireEvent.submit(form);
    await screen.findByText(/1x Corrente SRAM/);

    fireEvent.change(input, { target: { value: 'COR-01' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/2x Corrente SRAM/)).toBeInTheDocument();
    });
  });

  it('filtra o histórico por NF e fornecedor', async () => {
    render(
      <MemoryRouter>
        <Purchases />
      </MemoryRouter>,
    );
    await screen.findByText('Nenhuma compra ainda.');

    fireEvent.change(screen.getByLabelText('NF ou lote'), { target: { value: 'NF-88' } });
    fireEvent.change(screen.getByLabelText('Fornecedor da lista'), { target: { value: 's1' } });

    await waitFor(() => {
      expect(
        get.mock.calls.some(
          (call) =>
            String(call[0]).includes('/purchases?') &&
            String(call[0]).includes('q=NF-88') &&
            String(call[0]).includes('supplier=s1'),
        ),
      ).toBe(true);
    });
  });

  it('preenche o lote com as peças das OS paradas', async () => {
    render(
      <MemoryRouter initialEntries={['/compras?fromOs=1&supplier=s1']}>
        <Purchases />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/2x Corrente SRAM/)).toBeInTheDocument();
    expect(get.mock.calls.some((call) => String(call[0]).includes('/purchases/needed?supplier=s1'))).toBe(
      true,
    );
    expect(screen.getByLabelText('Observação')).toHaveValue('OS aguardando peça');
    expect(screen.getByLabelText('Fornecedor')).toHaveValue('s1');
  });
});
