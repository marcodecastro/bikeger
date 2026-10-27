import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductForm } from './ProductForm';
import type { Product } from '../types';

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

const product: Product = {
  _id: 'p1',
  sku: 'CAB-CAMB',
  barcode: '7891000000066',
  name: 'Cabo de câmbio inox',
  description: 'Cabo inox',
  category: 'Transmissão',
  brand: 'Jagwire',
  model: 'Sport',
  unit: 'UN',
  costPrice: 800,
  salePrice: 1990,
  currentStock: 40,
  minStock: 12,
  location: 'A-02',
  supplier: null,
  active: true,
  images: ['https://loja.test/cabo.jpg'],
  ncm: '87149990',
  cfop: '5102',
};

function renderForm(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/produtos/:id" element={<ProductForm />} />
        <Route path="/produtos" element={<div>Lista de produtos</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Ficha da peça', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    can.mockReset();
    can.mockReturnValue(true);
    get.mockImplementation(async (path: string) => {
      if (path === '/suppliers') return [];
      if (String(path).startsWith('/products/')) return product;
      return [];
    });
  });

  it('mostra o erro quando a peça não carrega', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/suppliers') return [];
      throw new Error('Produto não encontrado');
    });
    renderForm('/produtos/p1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Produto não encontrado');
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  });

  it('abre a ficha mesmo sem lista de imagens', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/suppliers') return [];
      return { ...product, images: undefined };
    });
    renderForm('/produtos/p1');
    expect(await screen.findByDisplayValue('Cabo de câmbio inox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
  });

  it('depois de cadastrar permanece na ficha para corrigir', async () => {
    const user = userEvent.setup();
    const created = { ...product, _id: 'p9', name: 'Peça nova' };
    get.mockImplementation(async (path: string) => {
      if (path === '/suppliers') return [];
      if (path === '/products/p9') return created;
      return [];
    });
    post.mockResolvedValue(created);

    renderForm('/produtos/novo');
    await user.type(screen.getByLabelText('Nome'), 'Peça nova');
    await user.click(screen.getByRole('button', { name: 'Cadastrar peça' }));

    expect(post).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    expect(screen.queryByText('Lista de produtos')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Pode corrigir/);
  });

  it('adiciona foto por URL na ficha', async () => {
    const user = userEvent.setup();
    put.mockResolvedValue({ ...product, images: ['https://loja.test/cabo.jpg', 'https://loja.test/cabo2.jpg'] });
    renderForm('/produtos/p1');
    const url = await screen.findByPlaceholderText('https://...');
    await user.type(url, 'https://loja.test/cabo2.jpg');
    await user.click(screen.getByRole('button', { name: 'Adicionar URL' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(put).toHaveBeenCalledWith(
      '/products/p1',
      expect.objectContaining({
        images: ['https://loja.test/cabo.jpg', 'https://loja.test/cabo2.jpg'],
      }),
    );
  });

  it('salva alterações sem voltar para a lista', async () => {
    const user = userEvent.setup();
    put.mockResolvedValue({ ...product, name: 'Cabo inox revisado' });
    renderForm('/produtos/p1');

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Cabo inox revisado');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(put).toHaveBeenCalledWith('/products/p1', expect.objectContaining({ name: 'Cabo inox revisado' }));
    expect(screen.queryByText('Lista de produtos')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Alterações salvas.');
  });
});
