import { addCents, multiplyCents, subtractCents } from './money';

export interface CartLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  available: number;
}

export function addCartLine(
  lines: CartLine[],
  incoming: Omit<CartLine, 'quantity'> & { quantity?: number },
): { lines: CartLine[]; error?: string } {
  const addQty = incoming.quantity ?? 1;
  if (incoming.available <= 0) {
    return { lines, error: `${incoming.name} sem estoque livre` };
  }

  const found = lines.find((line) => line.productId === incoming.productId);
  const nextQty = (found?.quantity ?? 0) + addQty;
  if (nextQty > incoming.available) {
    return { lines, error: `${incoming.name} sem estoque livre` };
  }

  if (!found) {
    return {
      lines: [...lines, { ...incoming, quantity: addQty }],
    };
  }

  return {
    lines: lines.map((line) =>
      line.productId === incoming.productId ? { ...line, quantity: nextQty } : line,
    ),
  };
}

export function cartTotals(
  lines: Pick<CartLine, 'quantity' | 'unitPrice'>[],
  discount: number,
  method: string,
  cashReceived: number,
) {
  const subtotal = lines.reduce(
    (sum, line) => addCents(sum, multiplyCents(line.unitPrice, line.quantity)),
    0,
  );
  const total = subtractCents(subtotal, Math.min(discount, subtotal));
  const change = method === 'dinheiro' ? Math.max(0, subtractCents(cashReceived, total)) : 0;
  return { subtotal, total, change };
}
