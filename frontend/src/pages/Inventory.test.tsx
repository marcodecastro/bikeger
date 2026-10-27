import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Inventory } from './Inventory';
import type { InventoryCount } from '../types';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
  patch: (...args: unknown[]) => patch(...args),
}));

const openCount: InventoryCount = {
  _id: 'inv1',
  number: 'INV-00001',
  status: 'aberta',
  notes: '',
  items: [
    {
      product: 'p1',
      sku: 'COR-01',
      name: 'Corrente SRAM',
      barcode: '789',
      systemQty: 2,
      countedQty: 1,
    },
  ],
  operator: 'estoque',
  appliedAt: null,
  createdAt: '2026-09-20T12:00:00.000Z',
};

describe('Inventário', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    get.mockImplementation(async (path: string) => {
      if (String(path).startsWith('/inventory')) return [openCount];
      return [];
    });
  });

  it('mostra o erro quando a contagem aberta não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar o inventário'));
    render(<Inventory />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar o inventário');
  });

  it('lista o histórico e confirma aplicar no modal', async () => {
    post.mockResolvedValue({ ...openCount, status: 'aplicada', appliedAt: '2026-09-20T13:00:00.000Z' });
    render(<Inventory />);
    expect(await screen.findByText('Contagens anteriores')).toBeInTheDocument();
    expect(screen.getAllByText('INV-00001').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar no estoque' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/vira a verdade do estoque/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e aplicar' }));
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/inventory/inv1/apply', {});
    });
  });

  it('mostra o erro quando o qty da contagem falha', async () => {
    patch.mockRejectedValue(new Error('Quantidade contada deve ser um inteiro não negativo'));
    render(<Inventory />);

    const qty = await screen.findByDisplayValue('1');
    fireEvent.change(qty, { target: { value: '-1' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/inteiro não negativo/i);
    expect(qty).toHaveValue(1);
  });
});
