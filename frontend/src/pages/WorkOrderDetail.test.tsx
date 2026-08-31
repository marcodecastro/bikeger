import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkOrderDetail } from './WorkOrderDetail';
import type { WorkOrder } from '../types';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
  patch: (...args: unknown[]) => patch(...args),
  del: (...args: unknown[]) => del(...args),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

const order: WorkOrder = {
  _id: 'os1',
  number: 'OS-00001',
  customer: {
    _id: 'c1',
    name: 'Ana',
    phone: '11988880000',
    email: '',
    document: '',
    active: true,
  },
  bike: {
    _id: 'b1',
    customer: 'c1',
    brand: 'Caloi',
    model: '10',
    color: '',
    serialNumber: '',
    frameSize: '',
    type: 'speed',
    notes: '',
  },
  status: 'pronta',
  complaint: 'Marcha pulando',
  diagnosis: 'Cabo',
  mechanic: 'Oficina',
  services: [],
  parts: [],
  laborTotal: 8000,
  partsTotal: 0,
  discount: 0,
  total: 8000,
  payments: [],
  paidAmount: 0,
  notes: '',
  createdAt: '2026-08-30T12:00:00.000Z',
};

describe('OS pronta', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
    can.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/os1') return order;
      if (path.startsWith('/products')) return [];
      if (path.startsWith('/services')) return [];
      return [];
    });
  });

  it('mostra aviso WhatsApp e esconde pagamento do mecânico', async () => {
    can.mockImplementation((capability: string) => capability !== 'payments');
    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'OS-00001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avisar no WhatsApp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument();
    expect(screen.getByText(/O balcão registra o pagamento/)).toBeInTheDocument();
  });

  it('ao escolher Cancelada chama POST /cancel e não PATCH de status', async () => {
    const user = userEvent.setup();
    can.mockReturnValue(false);
    post.mockResolvedValue({ ...order, status: 'cancelada' });

    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const status = await screen.findByLabelText('Status');
    await user.selectOptions(status, 'cancelada');

    expect(post).toHaveBeenCalledWith('/work-orders/os1/cancel');
    expect(patch).not.toHaveBeenCalled();
  });

  it('mostra o 409 ao cancelar OS com caixa fechado', async () => {
    const user = userEvent.setup();
    can.mockReturnValue(false);
    post.mockRejectedValue(
      new Error('Nenhum caixa aberto. Abra o caixa para registrar este movimento.'),
    );

    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const status = await screen.findByLabelText('Status');
    await user.selectOptions(status, 'cancelada');

    expect(post).toHaveBeenCalledWith('/work-orders/os1/cancel');
    expect(await screen.findByText(/nenhum caixa aberto/i)).toBeInTheDocument();
  });

  it('mostra o 409 do PIX sem deixar a promessa sem tratamento', async () => {
    const user = userEvent.setup();
    can.mockReturnValue(true);
    post.mockRejectedValue(
      new Error(
        'Já existe uma cobrança Mercado Pago em aberto para este documento, com outro valor. Aguarde o pagamento ou a expiração antes de gerar outra.',
      ),
    );

    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'PIX Mercado Pago' }));

    expect(post).toHaveBeenCalledWith('/payments/pix', {
      relatedType: 'workOrder',
      relatedId: 'os1',
    });
    expect(await screen.findByText(/já existe uma cobrança Mercado Pago/i)).toBeInTheDocument();
  });

  it('não gera dois PIX no clique duplo', async () => {
    can.mockReturnValue(true);
    let resolvePix: ((value: unknown) => void) | undefined;
    post.mockImplementation(() => new Promise((resolve) => {
      resolvePix = resolve;
    }));

    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const pix = await screen.findByRole('button', { name: 'PIX Mercado Pago' });
    fireEvent.click(pix);
    fireEvent.click(pix);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/payments/pix', {
      relatedType: 'workOrder',
      relatedId: 'os1',
    });
    expect(pix).toBeDisabled();
    resolvePix?.({
      _id: 'pix1',
      status: 'pending',
      amount: 8000,
      qrCode: '',
      qrCodeBase64: '',
      ticketUrl: '',
      paymentId: '',
    });
  });

  it('atualiza o pago da OS quando o PIX entra', async () => {
    can.mockReturnValue(true);
    post.mockResolvedValue({
      _id: 'pix1',
      status: 'pending',
      amount: 8000,
      qrCode: '000201',
      qrCodeBase64: '',
      ticketUrl: '',
      paymentId: 'mp-1',
    });

    let osLoads = 0;
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/os1') {
        osLoads += 1;
        if (osLoads > 1) {
          return {
            ...order,
            paidAmount: 8000,
            payments: [{ _id: 'p1', method: 'mercado_pago', amount: 8000, status: 'aprovado' }],
          };
        }
        return order;
      }
      if (path.startsWith('/payments?')) {
        return [
          {
            _id: 'pix1',
            status: 'approved',
            amount: 8000,
            qrCode: '000201',
            qrCodeBase64: '',
            ticketUrl: '',
            paymentId: 'mp-1',
          },
        ];
      }
      if (path.startsWith('/products')) return [];
      if (path.startsWith('/services')) return [];
      return [];
    });

    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'PIX Mercado Pago' }));
    expect(await screen.findByText(/Status: pending/)).toBeInTheDocument();
    expect(await screen.findByText(/Status: approved/)).toBeInTheDocument();
    expect(screen.getByText(/Pago R\$ 80,00/)).toBeInTheDocument();
  });

  it('mostra o 409 ao registrar pagamento com caixa fechado', async () => {
    const user = userEvent.setup();
    can.mockReturnValue(true);
    post.mockRejectedValue(
      new Error('Nenhum caixa aberto. Abra o caixa para registrar este movimento.'),
    );

    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Registrar' }));

    expect(post).toHaveBeenCalledWith('/work-orders/os1/payments', {
      method: 'pix',
      amount: 8000,
    });
    expect(await screen.findByText(/nenhum caixa aberto/i)).toBeInTheDocument();
  });
});

describe('OS entregue', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
    can.mockReset();
    get.mockImplementation(async (path: string) => {
      if (path === '/work-orders/os1') return { ...order, status: 'entregue', paidAmount: 8000 };
      if (path.startsWith('/products')) return [];
      if (path.startsWith('/services')) return [];
      return [];
    });
  });

  it('trava o status e esconde peça, serviço e recebimento', async () => {
    can.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/oficina/os1']}>
        <Routes>
          <Route path="/oficina/:id" element={<WorkOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const status = await screen.findByLabelText('Status');
    expect(status).toBeDisabled();
    expect(screen.queryByRole('option', { name: 'Aberta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cancelada' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reservar peça' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument();
    expect(screen.getByText(/OS encerrada/i)).toBeInTheDocument();
  });
});

