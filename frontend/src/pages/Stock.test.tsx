import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Stock } from './Stock';

const get = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

describe('Kardex', () => {
  beforeEach(() => {
    get.mockReset();
    can.mockReset();
    can.mockReturnValue(true);
  });

  it('mostra o erro quando o kardex não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar o kardex'));
    render(<Stock />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar o kardex');
  });

  it('filtra por SKU e tipo', async () => {
    get.mockImplementation(async (path: string) => {
      if (String(path).startsWith('/products')) return [];
      return [
        {
          _id: 'm1',
          sku: 'COR-01',
          name: 'Corrente',
          type: 'venda',
          direction: 'saida',
          quantity: 1,
          quantityBefore: 3,
          quantityAfter: 2,
          unitPrice: 15990,
          createdAt: '2026-10-20T12:00:00.000Z',
        },
      ];
    });
    render(<Stock />);
    expect((await screen.findAllByText('Corrente')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('SKU ou peça'), { target: { value: 'COR' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'venda' } });
    await waitFor(() => {
      expect(get.mock.calls.some((call) => String(call[0]).includes('q=COR') && String(call[0]).includes('type=venda'))).toBe(
        true,
      );
    });
  });
});
