import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cash } from './Cash';

const get = vi.fn();
const post = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
}));

describe('Caixa', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/cash/current') return null;
      if (path === '/cash') return [];
      return null;
    });
  });

  it('mostra o 409 quando já existe um caixa aberto', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new Error('Já existe um caixa aberto'));
    render(<Cash />);

    await user.click(await screen.findByRole('button', { name: 'Abrir caixa' }));

    expect(post).toHaveBeenCalledWith('/cash/open', { openingAmount: 0, operator: 'balcão' });
    expect(await screen.findByText(/já existe um caixa aberto/i)).toBeInTheDocument();
  });

  it('não abre o caixa duas vezes no clique duplo', async () => {
    let resolveOpen: ((value: unknown) => void) | undefined;
    post.mockImplementation(() => new Promise((resolve) => {
      resolveOpen = resolve;
    }));
    render(<Cash />);

    const open = await screen.findByRole('button', { name: 'Abrir caixa' });
    fireEvent.click(open);
    fireEvent.click(open);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/cash/open', { openingAmount: 0, operator: 'balcão' });
    expect(open).toBeDisabled();
    resolveOpen?.(null);
  });
});
