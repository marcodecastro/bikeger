import { describe, expect, it } from 'vitest';
import { openOsPath } from './os';

describe('atalho para abrir OS', () => {
  it('leva à oficina com o formulário aberto', () => {
    expect(openOsPath()).toBe('/oficina?nova=1');
    expect(openOsPath({ customerId: 'c1' })).toBe('/oficina?nova=1&cliente=c1');
    expect(openOsPath({ customerId: 'c1', bikeId: 'b1' })).toBe('/oficina?nova=1&cliente=c1&bike=b1');
  });
});
