import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from './Account';

const post = vi.fn();

vi.mock('../lib/api', () => ({
  post: (...args: unknown[]) => post(...args),
}));

const setUser = vi.fn();

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { name: 'Rita', login: 'balcao', role: 'balcao', mustChangePassword: true },
    setUser,
  }),
}));

describe('Minha senha', () => {
  beforeEach(() => {
    post.mockReset();
    setUser.mockReset();
    post.mockResolvedValue({ login: 'balcao', mustChangePassword: false });
  });

  it('recusa confirmação diferente e grava a senha nova', async () => {
    const user = userEvent.setup();
    render(<Account />);
    await user.type(screen.getByLabelText('Senha atual'), 'bikeger');
    await user.type(screen.getByLabelText('Nova senha'), 'senhanova1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'outraaaaa');
    await user.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/confirmação não bate/);
    expect(post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Confirmar nova senha'));
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'senhanova1');
    await user.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'bikeger',
      newPassword: 'senhanova1',
    });
    expect(setUser).toHaveBeenCalledWith({ login: 'balcao', mustChangePassword: false });
    expect(await screen.findByRole('status')).toHaveTextContent(/Senha alterada/);
  });

  it('avisa que o primeiro acesso exige troca de senha', async () => {
    render(<Account />);
    expect(screen.getByText(/Troque a senha neste primeiro acesso/)).toBeInTheDocument();
  });
});
