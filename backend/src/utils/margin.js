import { addCents, multiplyCents, subtractCents } from './money.js';

export function lineMargin({ unitPrice, unitCost, quantity, returnedQuantity = 0 }) {
  const qty = quantity - (returnedQuantity || 0);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { revenue: 0, cost: 0, profit: 0, quantity: 0 };
  }
  const revenue = multiplyCents(unitPrice, qty);
  const cost = multiplyCents(unitCost, qty);
  return {
    revenue,
    cost,
    profit: subtractCents(revenue, cost),
    quantity: qty,
  };
}

export function accumulateByCategory(lines) {
  const map = new Map();
  for (const line of lines) {
    const category = line.category || 'Sem categoria';
    const current = map.get(category) || {
      category,
      revenue: 0,
      cost: 0,
      profit: 0,
      quantity: 0,
    };
    current.revenue = addCents(current.revenue, line.revenue);
    current.cost = addCents(current.cost, line.cost);
    current.profit = addCents(current.profit, line.profit);
    current.quantity += line.quantity;
    map.set(category, current);
  }
  return [...map.values()].sort((left, right) => right.profit - left.profit);
}
