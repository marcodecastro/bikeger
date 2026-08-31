import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaleDetail } from './SaleDetail';
import type { FiscalDocument, Sale } from '../types';

const get = vi.fn();
const post = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
}));

const sale: Sale = {
  _id: 's1',
  number: 'VD-00001',
  customer: null,
  items: [{ _id: 'i1', sku: 'COR-01', name: 'Corrente', quantity: 1, unitPrice: 15990, total: 15990, product: 'p1' }],
  subtotal: 15990,
  discount: 0,
  total: 15990,
  payments: [{ _id: 'pay1', method: 'pix', amount: 15990, status: 'aprovado' }],
  paidAmount: 15990,
  cashReceived: 0,
  change: 0,
  status: 'paga',
  createdAt: '2026-08-30T12:00:00.000Z',
};

const authorizedNfce: FiscalDocument = {
  _id: 'nf1',
  relatedType: 'sale',
  relatedId: 's1',
  kind: 'nfce',
  status: 'autorizada',
  amount: 15990,
};

function renderSale() {
  return render(
    <MemoryRouter initialEntries={['/vendas/s1']}>
      <Routes>
        <Route path="/vendas/:id" element={<SaleDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Venda', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/sales/s1') return sale;
      if (path === '/fiscal/sale/s1') return [];
      return [];
    });
  });

  it('não gera duas NFC-e no clique duplo', async () => {
    let resolveFiscal: ((value: unknown) => void) | undefined;
    post.mockImplementation(() => new Promise((resolve) => {
      resolveFiscal = resolve;
    }));

    renderSale();

    const nfce = await screen.findByRole('button', { name: 'Gerar NFC-e' });
    fireEvent.click(nfce);
    fireEvent.click(nfce);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/fiscal/sale/s1');
    expect(nfce).toBeDisabled();
    resolveFiscal?.({ _id: 'nf1', status: 'pendente', amount: 15990 });
  });

  it('pede confirmação antes de cancelar a venda e não chama a API se desistir', async () => {
    const user = userEvent.setup();
    renderSale();

    await user.click(await screen.findByRole('button', { name: 'Cancelar e estornar estoque' }));
    expect(await screen.findByRole('heading', { name: 'Cancelar venda' })).toBeInTheDocument();
    expect(screen.getByText(/devolve as peças ao estoque/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('heading', { name: 'Cancelar venda' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('Escape fecha o modal de cancelar sem chamar a API', async () => {
    const user = userEvent.setup();
    renderSale();

    await user.click(await screen.findByRole('button', { name: 'Cancelar e estornar estoque' }));
    expect(await screen.findByRole('dialog', { name: 'Cancelar venda' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Cancelar venda' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('só cancela a venda depois de confirmar, uma vez só', async () => {
    let resolveCancel: ((value: unknown) => void) | undefined;
    post.mockImplementation(() => new Promise((resolve) => {
      resolveCancel = resolve;
    }));

    renderSale();

    const cancel = await screen.findByRole('button', { name: 'Cancelar e estornar estoque' });
    fireEvent.click(cancel);
    fireEvent.click(cancel);
    expect(post).not.toHaveBeenCalled();

    const confirm = await screen.findByRole('button', { name: 'Confirmar e estornar' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(post.mock.calls.filter((call) => call[0] === '/sales/s1/cancel')).toHaveLength(1);
    expect(confirm).toBeDisabled();
    resolveCancel?.({ ...sale, status: 'cancelada' });
    expect(await screen.findByRole('button', { name: 'Cancelar e estornar estoque' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Confirmar e estornar' })).not.toBeInTheDocument();
  });

  it('pede confirmação antes de cancelar a NFC-e', async () => {
    const user = userEvent.setup();
    get.mockImplementation(async (path: string) => {
      if (path === '/sales/s1') return sale;
      if (path === '/fiscal/sale/s1') return [authorizedNfce];
      return [];
    });
    post.mockResolvedValue({ ...authorizedNfce, status: 'cancelada' });

    renderSale();

    await user.click(await screen.findByRole('button', { name: 'Cancelar NFC-e' }));
    expect(await screen.findByRole('heading', { name: 'Cancelar NFC-e' })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento na SEFAZ' }));

    expect(post).toHaveBeenCalledWith('/fiscal/nf1/cancel', {
      justificativa: 'Cancelamento solicitado no painel BikeGer',
    });
  });
});
