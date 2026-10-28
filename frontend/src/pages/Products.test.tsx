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

    expect(get).toHaveBeenCalledWith('/products?q=cor&limit=50&skip=0');
    expect(get.mock.calls.filter((call) => String(call[0]).startsWith('/products')).length).toBe(2);
  });

  it('pede a próxima página em Ver mais', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({
      _id: `p${i}`,
      sku: `SKU-${i}`,
      name: `Peça ${i}`,
      brand: 'X',
      category: 'Transmissão',
      currentStock: 1,
      minStock: 0,
      unit: 'UN',
      salePrice: 100,
      costPrice: 50,
    }));
    get.mockResolvedValueOnce(page);
    get.mockResolvedValueOnce([{ ...page[0], _id: 'p50', sku: 'SKU-50', name: 'Peça extra' }]);

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ver mais' }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(get).toHaveBeenCalledWith('/products?limit=50&skip=50');
    expect(screen.getByText('Peça extra')).toBeInTheDocument();
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

  it('filtra abaixo do mínimo e peças inativas', async () => {
    get.mockResolvedValue([
      {
        _id: 'p1',
        sku: 'CAB-01',
        name: 'Cabo velho',
        brand: 'Jagwire',
        category: 'Transmissão',
        currentStock: 0,
        minStock: 2,
        unit: 'UN',
        salePrice: 1990,
        costPrice: 800,
        active: false,
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

    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: 'low' } });
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'false' } });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(get).toHaveBeenCalledWith('/products?lowStock=true&active=false&limit=50&skip=0');
    expect(screen.getByText(/inativa/)).toBeInTheDocument();
  });
});
