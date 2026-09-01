import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { httpError } from '../utils/asyncHandler.js';
import { assertCents } from '../utils/money.js';

/**
 * Toda alteração de estoque passa por aqui.
 * Atualiza product.currentStock de forma atômica e grava o kardex.
 * Passe `session` para participar da transação da venda/OS.
 */
export async function applyStockMovement({
  productId,
  type,
  direction,
  quantity,
  referenceType = null,
  referenceId = null,
  notes = '',
  operator = 'sistema',
  unitCost,
  unitPrice,
  session = null,
}) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'quantidade da movimentação deve ser um inteiro positivo');
  }

  const delta = direction === 'saida' ? -quantity : quantity;
  const opts = session ? { session } : {};

  let beforeDoc;

  if (direction === 'saida') {
    beforeDoc = await Product.findOneAndUpdate(
      {
        _id: productId,
        $expr: {
          $gte: [{ $subtract: ['$currentStock', { $ifNull: ['$reservedStock', 0] }] }, quantity],
        },
      },
      { $inc: { currentStock: delta } },
      { new: false, ...opts },
    );

    if (!beforeDoc) {
      const exists = await Product.findById(productId).session(session || undefined);
      if (!exists) throw httpError(404, 'Produto não encontrado');
      const available = exists.currentStock - (exists.reservedStock || 0);
      throw httpError(
        409,
        `Estoque insuficiente de ${exists.name}. Disponível: ${available} ${exists.unit} (${exists.reservedStock || 0} reservado)`,
      );
    }
  } else {
    beforeDoc = await Product.findByIdAndUpdate(
      productId,
      { $inc: { currentStock: delta } },
      { new: false, ...opts },
    );
    if (!beforeDoc) throw httpError(404, 'Produto não encontrado');
  }

  const quantityBefore = beforeDoc.currentStock;
  const quantityAfter = quantityBefore + delta;

  const [movement] = await StockMovement.create(
    [
      {
        product: productId,
        sku: beforeDoc.sku,
        name: beforeDoc.name,
        type,
        direction,
        quantity,
        quantityBefore,
        quantityAfter,
        unitCost: unitCost ?? beforeDoc.costPrice,
        unitPrice: unitPrice ?? beforeDoc.salePrice,
        referenceType,
        referenceId,
        notes,
        operator,
      },
    ],
    opts,
  );

  assertCents(movement.unitCost, 'custo unitário da movimentação');
  assertCents(movement.unitPrice, 'preço unitário da movimentação');

  const product = await Product.findById(productId).session(session || undefined);
  return { product, movement };
}

export async function adjustStockTo({
  productId,
  newQuantity,
  notes = '',
  operator = 'sistema',
  session = null,
}) {
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw httpError(400, 'Novo estoque deve ser um inteiro não negativo');
  }

  const opts = session ? { session } : {};
  const beforeDoc = await Product.findOneAndUpdate(
    {
      _id: productId,
      $expr: { $lte: [{ $ifNull: ['$reservedStock', 0] }, newQuantity] },
    },
    { $set: { currentStock: newQuantity } },
    { new: false, ...opts },
  );

  if (!beforeDoc) {
    const exists = await Product.findById(productId).session(session || undefined);
    if (!exists) throw httpError(404, 'Produto não encontrado');
    throw httpError(
      409,
      `Não dá para ajustar abaixo do reservado (${exists.reservedStock || 0} ${exists.unit})`,
    );
  }

  const diff = newQuantity - beforeDoc.currentStock;
  if (diff === 0) {
    const product = await Product.findById(productId).session(session || undefined);
    return { product, movement: null };
  }

  const movement = await writeKardex(beforeDoc, {
    type: 'ajuste',
    direction: diff > 0 ? 'entrada' : 'saida',
    quantity: Math.abs(diff),
    quantityBefore: beforeDoc.currentStock,
    quantityAfter: newQuantity,
    referenceType: 'adjustment',
    notes: notes || `Ajuste de ${beforeDoc.currentStock} para ${newQuantity}`,
    operator,
    session,
  });

  const product = await Product.findById(productId).session(session || undefined);
  return { product, movement };
}

function availableOf(product) {
  return (product.currentStock || 0) - (product.reservedStock || 0);
}

async function writeKardex(product, { type, direction, quantity, quantityBefore, quantityAfter, ...rest }) {
  const opts = rest.session ? { session: rest.session } : {};
  const [movement] = await StockMovement.create(
    [
      {
        product: product._id,
        sku: product.sku,
        name: product.name,
        type,
        direction,
        quantity,
        quantityBefore,
        quantityAfter,
        unitCost: rest.unitCost ?? product.costPrice,
        unitPrice: rest.unitPrice ?? product.salePrice,
        referenceType: rest.referenceType || null,
        referenceId: rest.referenceId || null,
        notes: rest.notes || '',
        operator: rest.operator || 'sistema',
      },
    ],
    opts,
  );
  assertCents(movement.unitCost, 'custo unitário da movimentação');
  assertCents(movement.unitPrice, 'preço unitário da movimentação');
  return movement;
}

export async function reserveStock({
  productId,
  quantity,
  referenceType = 'workOrder',
  referenceId = null,
  notes = '',
  operator = 'oficina',
  unitCost,
  unitPrice,
  session = null,
}) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'quantidade da reserva deve ser um inteiro positivo');
  }

  const beforeDoc = await Product.findOneAndUpdate(
    {
      _id: productId,
      $expr: {
        $gte: [{ $subtract: ['$currentStock', { $ifNull: ['$reservedStock', 0] }] }, quantity],
      },
    },
    { $inc: { reservedStock: quantity } },
    { new: false, ...(session ? { session } : {}) },
  );

  if (!beforeDoc) {
    const exists = await Product.findById(productId).session(session || undefined);
    if (!exists) throw httpError(404, 'Produto não encontrado');
    throw httpError(
      409,
      `Sem disponível para reservar ${exists.name}. Livre: ${availableOf(exists)} ${exists.unit}`,
    );
  }

  const movement = await writeKardex(beforeDoc, {
    type: 'reserva',
    direction: 'saida',
    quantity,
    quantityBefore: availableOf(beforeDoc),
    quantityAfter: availableOf(beforeDoc) - quantity,
    referenceType,
    referenceId,
    notes,
    operator,
    unitCost,
    unitPrice,
    session,
  });

  const product = await Product.findById(productId).session(session || undefined);
  return { product, movement };
}

export async function releaseReservation({
  productId,
  quantity,
  referenceType = 'workOrder',
  referenceId = null,
  notes = '',
  operator = 'oficina',
  unitCost,
  unitPrice,
  session = null,
}) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'quantidade da liberação deve ser um inteiro positivo');
  }

  const beforeDoc = await Product.findOneAndUpdate(
    { _id: productId, reservedStock: { $gte: quantity } },
    { $inc: { reservedStock: -quantity } },
    { new: false, ...(session ? { session } : {}) },
  );

  if (!beforeDoc) {
    const exists = await Product.findById(productId).session(session || undefined);
    if (!exists) throw httpError(404, 'Produto não encontrado');
    throw httpError(409, `Não há reserva suficiente de ${exists.name} para liberar`);
  }

  const movement = await writeKardex(beforeDoc, {
    type: 'reserva_liberada',
    direction: 'entrada',
    quantity,
    quantityBefore: availableOf(beforeDoc),
    quantityAfter: availableOf(beforeDoc) + quantity,
    referenceType,
    referenceId,
    notes,
    operator,
    unitCost,
    unitPrice,
    session,
  });

  const product = await Product.findById(productId).session(session || undefined);
  return { product, movement };
}

export async function consumeReservation({
  productId,
  quantity,
  referenceType = 'workOrder',
  referenceId = null,
  notes = '',
  operator = 'oficina',
  unitCost,
  unitPrice,
  session = null,
}) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'quantidade do consumo deve ser um inteiro positivo');
  }

  const beforeDoc = await Product.findOneAndUpdate(
    { _id: productId, reservedStock: { $gte: quantity }, currentStock: { $gte: quantity } },
    { $inc: { reservedStock: -quantity, currentStock: -quantity } },
    { new: false, ...(session ? { session } : {}) },
  );

  if (!beforeDoc) {
    const exists = await Product.findById(productId).session(session || undefined);
    if (!exists) throw httpError(404, 'Produto não encontrado');
    throw httpError(
      409,
      `Não foi possível consumir a reserva de ${exists.name}. Reservado: ${exists.reservedStock || 0}`,
    );
  }

  const movement = await writeKardex(beforeDoc, {
    type: 'os',
    direction: 'saida',
    quantity,
    quantityBefore: beforeDoc.currentStock,
    quantityAfter: beforeDoc.currentStock - quantity,
    referenceType,
    referenceId,
    notes,
    operator,
    unitCost,
    unitPrice,
    session,
  });

  const product = await Product.findById(productId).session(session || undefined);
  return { product, movement };
}
