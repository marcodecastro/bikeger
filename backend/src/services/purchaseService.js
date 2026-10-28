import { Purchase } from '../models/Purchase.js';
import { Product } from '../models/Product.js';
import { Supplier } from '../models/Supplier.js';
import { nextNumber } from '../utils/ids.js';
import { addCents, assertCents, multiplyCents, weightedAverageCost } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { applyStockMovement } from './stockService.js';
import { runInTransaction } from '../utils/transaction.js';
import { listLimit, listSkip } from '../utils/listLimit.js';
import { searchRegex } from '../utils/searchRegex.js';

export async function listPurchases({ limit, skip, supplier, q, from, to } = {}) {
  const filter = {};
  if (supplier) filter.supplier = supplier;
  const rx = searchRegex(q);
  if (rx) {
    filter.$or = [{ invoiceNumber: rx }, { number: rx }, { notes: rx }];
  }
  if (from || to) {
    filter.receivedAt = {};
    if (from) filter.receivedAt.$gte = new Date(from);
    if (to) filter.receivedAt.$lte = new Date(to);
  }
  return Purchase.find(filter)
    .populate('supplier', 'name tradeName')
    .sort({ receivedAt: -1, createdAt: -1 })
    .skip(listSkip(skip))
    .limit(listLimit(limit));
}

export async function getPurchase(id) {
  const purchase = await Purchase.findById(id).populate('supplier').populate('items.product', 'name sku');
  if (!purchase) throw httpError(404, 'Compra não encontrada');
  return purchase;
}

export async function receivePurchase({
  supplierId,
  notes = '',
  invoiceNumber = '',
  items = [],
  operator = 'estoque',
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError(400, 'Informe pelo menos uma peça na compra');
  }

  const purchaseId = await runInTransaction(async (session) => {
    const supplier = await Supplier.findById(supplierId).session(session || undefined);
    if (!supplier) throw httpError(404, 'Fornecedor não encontrado');

    const [purchase] = await Purchase.create(
      [
        {
          number: await nextNumber('purchase', 'CP', 5, session),
          supplier: supplier._id,
          notes,
          invoiceNumber: String(invoiceNumber || '').trim(),
          items: [],
          itemsTotal: 0,
          operator,
          receivedAt: new Date(),
        },
      ],
      { session: session || undefined },
    );

    const lines = [];
    let itemsTotal = 0;

    for (const raw of items) {
      const quantity = raw.quantity;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw httpError(400, 'Quantidade da compra deve ser um inteiro positivo');
      }
      const unitCost = assertCents(raw.unitCost, 'custo da peça');
      const product = await Product.findById(raw.productId).session(session || undefined);
      if (!product) throw httpError(404, 'Produto não encontrado');

      const total = multiplyCents(unitCost, quantity);
      itemsTotal = addCents(itemsTotal, total);
      const averageCost = weightedAverageCost(product.currentStock, product.costPrice, quantity, unitCost);

      await applyStockMovement({
        productId: product._id,
        type: 'compra',
        direction: 'entrada',
        quantity,
        referenceType: 'purchase',
        referenceId: purchase._id,
        notes: notes || `Compra ${purchase.number} — ${product.name}`,
        operator,
        unitCost,
        unitPrice: product.salePrice,
        session,
      });

      await Product.findByIdAndUpdate(
        product._id,
        { costPrice: averageCost, supplier: supplier._id },
        { session: session || undefined, runValidators: true },
      );

      lines.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        quantity,
        unitCost,
        total,
      });
    }

    purchase.items = lines;
    purchase.itemsTotal = itemsTotal;
    await purchase.save({ session: session || undefined });
    return purchase._id;
  });

  return getPurchase(purchaseId);
}
