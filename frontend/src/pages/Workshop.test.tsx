import { render, screen, fireEvent } from '@testing-library/react';
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
});
