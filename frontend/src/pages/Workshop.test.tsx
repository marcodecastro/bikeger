import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Workshop } from './Workshop';

const get = vi.fn();
const post = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
}));

describe('Oficina', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/board') return { counts: {}, columns: {} };
      if (path === '/work-orders/mechanics') return { mechanicNames: ['Oficina'] };
      return [];
    });
  });

  it('mostra o erro quando o quadro não carrega', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/board') throw new Error('Falha ao listar a oficina');
      if (path === '/work-orders/mechanics') return { mechanicNames: ['Oficina'] };
      return [];
    });
    render(
      <MemoryRouter>
        <Workshop />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar a oficina');
  });

  it('não abre duas OS no clique duplo', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: unknown) => void) | undefined;
    post.mockImplementation(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    render(
      <MemoryRouter>
        <Workshop />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Nova OS' }));
    const open = await screen.findByRole('button', { name: 'Abrir OS' });
    fireEvent.click(open);
    fireEvent.click(open);

    expect(post.mock.calls.filter((call) => call[0] === '/work-orders')).toHaveLength(1);
    expect(open).toBeDisabled();
    resolveCreate?.({ _id: 'os1' });
  });

  it('busca OS entregue por número', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/board') return { counts: {}, columns: {} };
      if (path === '/work-orders/mechanics') return { mechanicNames: ['Oficina'] };
      if (String(path).startsWith('/work-orders?')) {
        return [
          {
            _id: 'os42',
            number: 'OS-00042',
            status: 'entregue',
            total: 19900,
            customer: { name: 'Clara Mendes' },
            bike: { brand: 'Caloi', model: 'Elite' },
          },
        ];
      }
      return [];
    });

    render(
      <MemoryRouter>
        <Workshop />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Buscar OS'), { target: { value: 'OS-00042' } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 180));
    });

    expect(get.mock.calls.some((call) => String(call[0]).includes('/work-orders?') && String(call[0]).includes('q=OS-00042'))).toBe(
      true,
    );
    expect(await screen.findByText('OS-00042')).toBeInTheDocument();
    expect(screen.getByText('Clara Mendes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /OS-00042/ })).toHaveAttribute('href', '/oficina/os42');
  });

  it('lista só as entregues no filtro de status', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/board') return { counts: {}, columns: {} };
      if (path === '/work-orders/mechanics') return { mechanicNames: ['Oficina'] };
      if (String(path).includes('status=entregue')) {
        return [{ _id: 'os1', number: 'OS-00001', status: 'entregue', total: 0, customer: { name: 'Ana' }, bike: { brand: 'Sense', model: 'Fun' } }];
      }
      return [];
    });

    render(
      <MemoryRouter>
        <Workshop />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'entregue' } });
    expect(await screen.findByText('OS-00001')).toBeInTheDocument();
    expect(get.mock.calls.some((call) => String(call[0]).includes('status=entregue'))).toBe(true);
  });
});
