import { describe, expect, it } from 'vitest';
import { addCartLine, cartTotals } from './cart';

const peca = {
  productId: 'p1',
  name: 'Corrente SRAM',
  unitPrice: 15990,
  available: 2,
};

describe('carrinho do PDV', () => {
  it('soma em centavos e calcula troco em dinheiro', () => {
    const { lines } = addCartLine([], peca);
    const again = addCartLine(lines, peca);
    const totals = cartTotals(again.lines, 990, 'dinheiro', 40000);
    expect(again.lines[0].quantity).toBe(2);
    expect(totals.subtotal).toBe(31980);
    expect(totals.total).toBe(30990);
    expect(totals.change).toBe(9010);
  });

  it('bloqueia quantidade acima do estoque livre', () => {
    const first = addCartLine([], peca);
    const second = addCartLine(first.lines, peca);
    const overflow = addCartLine(second.lines, peca);
    expect(overflow.error).toMatch(/sem estoque livre/);
    expect(overflow.lines[0].quantity).toBe(2);
  });
});
