import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Suppliers } from './Suppliers';
import type { Supplier } from '../types';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
  put: (...args: unknown[]) => put(...args),
}));

const supplier: Supplier = {
  _id: 'sup1',
  name: 'Shimano Brasil',
  phone: '11 3000-0000',
  city: 'São Paulo',
  document: '',
  email: '',
  active: true,
};

describe('Fornecedores', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    get.mockResolvedValue([supplier]);
    put.mockResolvedValue({ ...supplier, city: 'Osasco' });
  });

  it('abre a ficha para corrigir o fornecedor', async () => {
    const user = userEvent.setup();
    render(<Suppliers />);

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar fornecedor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Shimano Brasil');

    await user.clear(screen.getByLabelText('Cidade'));
    await user.type(screen.getByLabelText('Cidade'), 'Osasco');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(put).toHaveBeenCalledWith(
      '/suppliers/sup1',
      expect.objectContaining({ name: 'Shimano Brasil', city: 'Osasco' }),
    );
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar fornecedores'));
    render(<Suppliers />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar fornecedores');
  });
});
