import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { accumulateByCategory, lineMargin } from '../utils/margin.js';

export async function marginByCategory({ from, to } = {}) {
  const filter = { status: { $in: ['paga', 'devolvida'] } };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const sales = await Sale.find(filter);
  const productIds = [...new Set(sales.flatMap((sale) => sale.items.map((item) => String(item.product))))];
  const products = await Product.find({ _id: { $in: productIds } }).select('category');
  const categoryById = new Map(products.map((product) => [String(product._id), product.category]));

  const lines = [];
  for (const sale of sales) {
    for (const item of sale.items) {
      const margin = lineMargin({
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        quantity: item.quantity,
        returnedQuantity: item.returnedQuantity || 0,
      });
      if (!margin.quantity) continue;
      lines.push({
        ...margin,
        category: item.category || categoryById.get(String(item.product)) || 'Sem categoria',
      });
    }
  }

  return accumulateByCategory(lines);
}
