import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';

const get = vi.fn();
const login = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: null, login }),
}));

describe('Login', () => {
  beforeEach(() => {
    get.mockReset();
    login.mockReset();
    get.mockResolvedValue({ demoUsers: false });
  });

  it('mostra o 429 quando o login está bloqueado', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(
      new Error('Muitas tentativas de login. Espere alguns minutos e tente de novo.'),
    );

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/muitas tentativas de login/i)).toBeInTheDocument();
  });
});
