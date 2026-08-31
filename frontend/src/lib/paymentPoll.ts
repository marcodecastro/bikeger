export const PIX_POLL_MS = import.meta.env.MODE === 'test' ? 25 : 4_000;

export interface PaymentReturnLink {
  type: 'sale' | 'workOrder';
  id: string;
  href: string;
  label: string;
}

export interface PaymentReturnCopy {
  title: string;
  body: string;
  tone: 'ok' | 'warn' | 'danger' | 'info';
}

export function parsePaymentReference(ref: string | null | undefined): PaymentReturnLink | null {
  const value = String(ref || '').trim();
  const sep = value.indexOf(':');
  if (sep <= 0) return null;
  const type = value.slice(0, sep);
  const id = value.slice(sep + 1).trim();
  if (!id || id === 'null') return null;
  if (type === 'sale') return { type, id, href: `/vendas/${id}`, label: 'Abrir a venda' };
  if (type === 'workOrder') return { type, id, href: `/oficina/${id}`, label: 'Abrir a OS' };
  return null;
}

export function paymentReturnCopy(status: string | null | undefined): PaymentReturnCopy {
  const key = String(status || '').toLowerCase();
  if (key === 'approved' || key === 'success') {
    return {
      title: 'Pagamento aprovado',
      body: 'O Mercado Pago confirmou. Se o caixa estiver aberto, a venda ou a OS atualiza sozinha.',
      tone: 'ok',
    };
  }
  if (key === 'pending' || key === 'in_process' || key === 'in_mediation') {
    return {
      title: 'Pagamento em processamento',
      body: 'Ainda não caiu. Confira o PIX na OS ou espere alguns segundos e atualize.',
      tone: 'warn',
    };
  }
  if (key === 'rejected' || key === 'failure' || key === 'cancelled' || key === 'canceled') {
    return {
      title: 'Pagamento não concluído',
      body: 'O cliente não pagou ou o Mercado Pago recusou. Gere uma cobrança nova se precisar.',
      tone: 'danger',
    };
  }
  return {
    title: 'Retorno do Mercado Pago',
    body: 'Não veio status nesta URL. Volte à venda ou à OS para conferir se o pagamento entrou.',
    tone: 'info',
  };
}

export function mpPaymentId(params: { get: (key: string) => string | null }) {
  for (const key of ['payment_id', 'collection_id'] as const) {
    const id = params.get(key);
    if (id && id !== 'null') return id;
  }
  return '';
}

export function mpPaymentStatus(params: { get: (key: string) => string | null }) {
  return params.get('status') || params.get('collection_status') || '';
}

export function isOpenPixStatus(status: string | undefined) {
  return status === 'pending' || status === 'in_process';
}
