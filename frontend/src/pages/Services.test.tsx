import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Services } from './Services';
import type { CatalogService } from '../types';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
  put: (...args: unknown[]) => put(...args),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

const service: CatalogService = {
  _id: 'svc1',
  name: 'Revisão completa',
  description: '',
  category: 'Revisão',
  price: 18000,
  estimatedMinutes: 90,
  active: true,
};

describe('Serviços', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    can.mockReset();
    can.mockReturnValue(true);
    get.mockResolvedValue([service]);
    put.mockResolvedValue({ ...service, name: 'Revisão 30 pontos' });
  });

  it('abre a ficha para corrigir o serviço', async () => {
    const user = userEvent.setup();
    render(<Services />);

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar serviço' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Revisão completa');

    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Revisão 30 pontos');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(put).toHaveBeenCalledWith(
      '/services/svc1',
      expect.objectContaining({ name: 'Revisão 30 pontos', estimatedMinutes: 90 }),
    );
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar serviços'));
    render(<Services />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar serviços');
  });
});
