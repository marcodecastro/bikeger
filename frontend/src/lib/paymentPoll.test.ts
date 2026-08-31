import { describe, expect, it } from 'vitest';
import {
  mpPaymentId,
  parsePaymentReference,
  paymentReturnCopy,
} from './paymentPoll';

describe('retorno MP', () => {
  it('abre venda ou OS a partir do external_reference', () => {
    expect(parsePaymentReference('sale:abc')).toEqual({
      type: 'sale',
      id: 'abc',
      href: '/vendas/abc',
      label: 'Abrir a venda',
    });
    expect(parsePaymentReference('workOrder:os1')).toMatchObject({ href: '/oficina/os1' });
    expect(parsePaymentReference('sale:')).toBeNull();
    expect(parsePaymentReference('outro:x')).toBeNull();
  });

  it('ignora payment_id nulo que o MP manda como texto', () => {
    const params = new URLSearchParams('payment_id=null&collection_id=77');
    expect(mpPaymentId(params)).toBe('77');
  });

  it('traduz o status do checkout', () => {
    expect(paymentReturnCopy('approved').title).toBe('Pagamento aprovado');
    expect(paymentReturnCopy('pending').tone).toBe('warn');
    expect(paymentReturnCopy('rejected').tone).toBe('danger');
  });
});
