import { describe, expect, it } from 'vitest';
import { allowedOsStatuses, isOsTerminal, OS_KANBAN, COUNTER_PAYMENT_METHODS } from './labels';

describe('máquina de status da OS', () => {
  it('oficina pode pular etapa e voltar, mas só entrega a partir de pronta', () => {
    expect(allowedOsStatuses('pronta')).toEqual(
      expect.arrayContaining(['aberta', 'em_servico', 'pronta', 'entregue', 'cancelada']),
    );
    expect(allowedOsStatuses('aberta')).toEqual(
      expect.arrayContaining(['aberta', 'em_servico', 'pronta', 'cancelada']),
    );
    expect(allowedOsStatuses('aberta')).not.toContain('entregue');
    expect(isOsTerminal('pronta')).toBe(false);
  });

  it('entregue e cancelada só mostram o próprio status', () => {
    expect(allowedOsStatuses('entregue')).toEqual(['entregue']);
    expect(allowedOsStatuses('cancelada')).toEqual(['cancelada']);
    expect(isOsTerminal('entregue')).toBe(true);
    expect(isOsTerminal('cancelada')).toBe(true);
  });

  it('o kanban mostra cancelada e esconde entregue', () => {
    expect(OS_KANBAN).toContain('orcamento');
    expect(OS_KANBAN).toContain('cancelada');
    expect(OS_KANBAN).not.toContain('entregue');
  });

  it('recebimento no balcão não inclui PIX nem Mercado Pago', () => {
    expect(COUNTER_PAYMENT_METHODS).toEqual(['dinheiro', 'cartao_credito', 'cartao_debito']);
    expect(COUNTER_PAYMENT_METHODS).not.toContain('pix');
    expect(COUNTER_PAYMENT_METHODS).not.toContain('mercado_pago');
  });
});
