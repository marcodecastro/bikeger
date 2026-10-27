import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Users } from './Users';
import type { AuthUser } from '../lib/permissions';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
  patch: (...args: unknown[]) => patch(...args),
}));

const user: AuthUser = {
  id: 'u1',
  name: 'Rita',
  login: 'balcao',
  role: 'balcao',
  active: true,
};

describe('Equipe', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    get.mockResolvedValue([user]);
    patch.mockResolvedValue({ ...user, name: 'Rita Souza', role: 'mecanico' });
  });

  it('abre a ficha para corrigir nome, perfil e senha', async () => {
    const clicker = userEvent.setup();
    render(<Users />);

    await clicker.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar usuário' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Rita');
    expect(screen.getByLabelText('Login')).toBeDisabled();

    await clicker.clear(screen.getByLabelText('Nome'));
    await clicker.type(screen.getByLabelText('Nome'), 'Rita Souza');
    await clicker.selectOptions(screen.getByLabelText('Perfil'), 'mecanico');
    await clicker.type(screen.getByLabelText('Nova senha (opcional)'), 'senhanova1');
    await clicker.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(patch).toHaveBeenCalledWith('/users/u1', {
      name: 'Rita Souza',
      role: 'mecanico',
      password: 'senhanova1',
    });
  });

  it('não envia senha quando o campo fica em branco', async () => {
    const clicker = userEvent.setup();
    render(<Users />);

    await clicker.click(await screen.findByRole('button', { name: 'Editar' }));
    await clicker.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(patch).toHaveBeenCalledWith('/users/u1', { name: 'Rita', role: 'balcao' });
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar equipe'));
    render(<Users />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar equipe');
  });
});
