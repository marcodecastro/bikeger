import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Products } from './Products';

const get = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

describe('Produtos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
    can.mockReset();
    can.mockReturnValue(true);
    get.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não dispara GET a cada tecla da busca', async () => {
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(get.mock.calls.filter((call) => String(call[0]).startsWith('/products')).length).toBe(1);

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'co' } });
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'cor' } });

    expect(get.mock.calls.filter((call) => String(call[0]).startsWith('/products')).length).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(160);
    });

    expect(get).toHaveBeenCalledWith('/products?q=cor');
    expect(get.mock.calls.filter((call) => String(call[0]).startsWith('/products')).length).toBe(2);
  });

  it('oferece Editar na peça quando o usuário pode gravar', async () => {
    get.mockResolvedValue([
      {
        _id: 'p1',
        sku: 'CAB-01',
        name: 'Cabo de câmbio',
        brand: 'Jagwire',
        category: 'Transmissão',
        currentStock: 4,
        minStock: 2,
        unit: 'UN',
        salePrice: 1990,
        costPrice: 800,
      },
    ]);

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/produtos/p1');
    expect(screen.getByRole('link', { name: 'Cabo de câmbio' })).toHaveAttribute('href', '/produtos/p1');
    expect(screen.queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument();
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar produtos'));

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao listar produtos');
  });
});
