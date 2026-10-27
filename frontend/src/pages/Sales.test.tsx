import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sales } from './Sales';

const get = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
}));

const sale = {
  _id: 's1',
  number: 'VD-00001',
  customer: { name: 'Bruno Costa' },
  status: 'paga',
  total: 34990,
};

describe('Vendas', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue([]);
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar vendas'));
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar vendas');
  });

  it('mostra estado vazio quando não há cupom', async () => {
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Nenhuma venda ainda/)).toBeInTheDocument();
  });

  it('pede a próxima página em Ver mais', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({
      ...sale,
      _id: `s${i}`,
      number: `VD-${String(i).padStart(5, '0')}`,
    }));
    get.mockResolvedValueOnce(page);
    get.mockResolvedValueOnce([{ ...sale, _id: 's50', number: 'VD-00050' }]);
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ver mais' }));
    expect(await screen.findByText('VD-00050')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/sales?limit=50&skip=50');
  });

  it('filtra por status na lista', async () => {
    get.mockResolvedValue([sale]);
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    );
    await screen.findByRole('link', { name: 'VD-00001' });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paga' } });
    expect(await screen.findByRole('link', { name: 'VD-00001' })).toBeInTheDocument();
    expect(get.mock.calls.some((call) => String(call[0]).includes('status=paga'))).toBe(true);
  });

  it('abre o cupom pelo número e pelo botão', async () => {
    get.mockResolvedValue([sale]);
    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'VD-00001' })).toHaveAttribute('href', '/vendas/s1');
    expect(screen.getByRole('link', { name: 'Abrir cupom' })).toHaveAttribute('href', '/vendas/s1');
    expect(screen.getByText('R$ 349,90')).toBeInTheDocument();
  });
});
