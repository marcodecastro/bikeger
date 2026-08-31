import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentReturn } from './PaymentReturn';

const post = vi.fn();

vi.mock('../lib/api', () => ({
  post: (...args: unknown[]) => post(...args),
  get: vi.fn(),
}));

function renderReturn(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/pagamentos/retorno${search}`]}>
      <Routes>
        <Route path="/pagamentos/retorno" element={<PaymentReturn />} />
        <Route path="/vendas/:id" element={<p>venda</p>} />
        <Route path="/" element={<p>painel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Retorno Mercado Pago', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ status: 'approved' });
  });

  it('mostra aprovado, sincroniza o payment_id e aponta para a venda', async () => {
    renderReturn('?status=approved&payment_id=999&external_reference=sale:abc123');

    expect(screen.getByRole('heading', { name: 'Pagamento aprovado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir a venda' })).toHaveAttribute('href', '/vendas/abc123');
    expect(screen.getByRole('link', { name: 'Ir ao painel' })).toHaveAttribute('href', '/');

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/payments/999/sync');
    });
  });

  it('mostra recusa sem chamar sync quando não há payment_id', () => {
    renderReturn('?status=rejected&payment_id=null&external_reference=workOrder:os1');

    expect(screen.getByRole('heading', { name: 'Pagamento não concluído' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir a OS' })).toHaveAttribute('href', '/oficina/os1');
    expect(post).not.toHaveBeenCalled();
  });

  it('mostra o 409 do caixa se o sync recusar', async () => {
    post.mockRejectedValue(
      new Error('Nenhum caixa aberto. Abra o caixa para registrar este movimento.'),
    );
    renderReturn('?collection_status=approved&collection_id=555');

    expect(screen.getByRole('heading', { name: 'Pagamento aprovado' })).toBeInTheDocument();
    expect(
      await screen.findByText(/nenhum caixa aberto/i),
    ).toBeInTheDocument();
  });
});
