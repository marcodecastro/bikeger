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

    await user.type(screen.getByLabelText('Login'), 'dono');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/muitas tentativas de login/i)).toBeInTheDocument();
  });

  it('não sugere perfis nem senha de demo fora do ambiente de desenvolvimento', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Login')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Dono/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Balcão/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mecânico/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ambiente de desenvolvimento/)).not.toBeInTheDocument();
    expect(await screen.findByText(/Todos os direitos reservados/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'notemaster' })).toHaveAttribute(
      'href',
      'https://www.notemaster.com.br/',
    );
    expect(screen.getByRole('link', { name: 'Marco de Castro' })).toHaveAttribute(
      'href',
      'https://www.reddit.com/user/marquinhodecastro/',
    );
  });

  it('mostra os atalhos de perfil só quando a API marca demoUsers', async () => {
    get.mockResolvedValue({ demoUsers: true });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Dono/i })).toBeInTheDocument();
    expect(screen.getByText(/Ambiente de desenvolvimento/)).toBeInTheDocument();
  });
});
