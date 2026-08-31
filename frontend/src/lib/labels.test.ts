import { describe, expect, it } from 'vitest';
import { allowedOsStatuses, isOsTerminal, OS_KANBAN } from './labels';

describe('máquina de status da OS', () => {
  it('oficina pode ir para qualquer status aberto, inclusive cancelar e entregar', () => {
    expect(allowedOsStatuses('pronta')).toEqual(
      expect.arrayContaining(['aberta', 'em_servico', 'pronta', 'entregue', 'cancelada']),
    );
    expect(isOsTerminal('pronta')).toBe(false);
  });

  it('entregue e cancelada só mostram o próprio status', () => {
    expect(allowedOsStatuses('entregue')).toEqual(['entregue']);
    expect(allowedOsStatuses('cancelada')).toEqual(['cancelada']);
    expect(isOsTerminal('entregue')).toBe(true);
    expect(isOsTerminal('cancelada')).toBe(true);
  });

  it('o kanban mostra cancelada e esconde entregue', () => {
    expect(OS_KANBAN).toContain('cancelada');
    expect(OS_KANBAN).not.toContain('entregue');
  });
});
