import { InventoryCount } from '../models/InventoryCount.js';
import { Product } from '../models/Product.js';
import { nextNumber } from '../utils/ids.js';
import { httpError } from '../utils/asyncHandler.js';
import { adjustStockTo } from './stockService.js';
import { runInTransaction } from '../utils/transaction.js';
import { listLimit } from '../utils/listLimit.js';

function assertOpen(count) {
  if (count.status === 'aberta') return;
  throw httpError(400, 'Essa contagem já foi encerrada');
}

export async function listInventoryCounts({ limit, status } = {}) {
  const filter = {};
  if (status) filter.status = status;
  return InventoryCount.find(filter).sort({ createdAt: -1 }).limit(listLimit(limit));
}

export async function getInventoryCount(id) {
  const count = await InventoryCount.findById(id);
  if (!count) throw httpError(404, 'Contagem não encontrada');
  return count;
}

export async function startInventoryCount({ notes = '', operator = 'estoque' } = {}) {
  const open = await InventoryCount.findOne({ status: 'aberta' });
  if (open) return open;
  try {
    return await InventoryCount.create({
      number: await nextNumber('inventory', 'INV'),
      notes,
      operator,
    });
  } catch (error) {
    if (error.code === 11000) {
      const again = await InventoryCount.findOne({ status: 'aberta' });
      if (again) return again;
    }
    throw error;
  }
}

export async function scanInventoryItem(id, { code, productId, quantity = 1 }) {
  const count = await getInventoryCount(id);
  assertOpen(count);
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw httpError(400, 'Quantidade da contagem deve ser um inteiro diferente de zero');
  }

  let product;
  if (productId) {
    product = await Product.findById(productId);
  } else {
    const trimmed = String(code || '').trim();
    if (!trimmed) throw httpError(400, 'Informe o código de barras ou o SKU');
    product = await Product.findOne({
      $or: [{ barcode: trimmed }, { sku: trimmed.toUpperCase() }],
      active: true,
    });
  }
  if (!product) throw httpError(404, 'Produto não encontrado');

  const existing = count.items.find((item) => String(item.product) === String(product._id));
  if (existing) {
    const next = existing.countedQty + quantity;
    if (next < 0) throw httpError(400, 'Contagem não pode ficar negativa');
    existing.countedQty = next;
  } else {
    if (quantity < 0) throw httpError(400, 'Contagem não pode ficar negativa');
    count.items.push({
      product: product._id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || '',
      systemQty: product.currentStock,
      countedQty: quantity,
    });
  }

  await count.save();
  return count;
}

export async function setInventoryItemQty(id, productId, countedQty) {
  const count = await getInventoryCount(id);
  assertOpen(count);
  if (!Number.isInteger(countedQty) || countedQty < 0) {
    throw httpError(400, 'Quantidade contada deve ser um inteiro não negativo');
  }
  const item = count.items.find((row) => String(row.product) === String(productId));
  if (!item) throw httpError(404, 'Peça ainda não entrou nesta contagem');
  item.countedQty = countedQty;
  await count.save();
  return count;
}

export async function applyInventoryCount(id, operator = 'estoque') {
  await runInTransaction(async (session) => {
    const count = await InventoryCount.findById(id).session(session || undefined);
    if (!count) throw httpError(404, 'Contagem não encontrada');
    assertOpen(count);
    if (!count.items.length) throw httpError(400, 'Conte pelo menos uma peça antes de aplicar');

    const claimed = await InventoryCount.findOneAndUpdate(
      { _id: id, status: 'aberta' },
      {
        $set: {
          status: 'aplicada',
          appliedAt: new Date(),
          operator: operator || count.operator,
        },
      },
      { new: true, session: session || undefined },
    );
    if (!claimed) throw httpError(409, 'Essa contagem já foi encerrada');

    for (const item of claimed.items) {
      await adjustStockTo({
        productId: item.product,
        newQuantity: item.countedQty,
        notes: `Inventário ${claimed.number}`,
        operator,
        session,
      });
    }
  });
  return getInventoryCount(id);
}

export async function cancelInventoryCount(id) {
  const count = await getInventoryCount(id);
  assertOpen(count);
  count.status = 'cancelada';
  await count.save();
  return count;
}
