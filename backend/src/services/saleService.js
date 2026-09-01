import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import '../models/Customer.js';
import { nextNumber } from '../utils/ids.js';
import { addCents, assertCents, multiplyCents, subtractCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { runInTransaction } from '../utils/transaction.js';
import { applyStockMovement } from './stockService.js';
import { registerLedgerMovement, requireOpenRegister, reverseLedgerForReference } from './cashService.js';
import { cancelAuthorizedFor, enqueueFiscalDocument } from './fiscalService.js';

export function recalcSaleTotals(sale) {
  const subtotal = sale.items.reduce((sum, item) => addCents(sum, item.total), 0);
  sale.subtotal = subtotal;
  sale.discount = assertCents(sale.discount || 0, 'desconto');
  if (sale.discount > subtotal) throw httpError(400, 'Desconto maior que o subtotal');
  sale.total = subtractCents(subtotal, sale.discount);
  sale.paidAmount = sale.payments
    .filter((payment) => payment.status === 'aprovado')
    .reduce((sum, payment) => addCents(sum, payment.amount), 0);
  return sale;
}

export async function createSale(payload) {
  const {
    customer = null,
    items = [],
    discount = 0,
    payments = [],
    cashReceived = 0,
    notes = '',
    operator = 'balcão',
  } = payload;

  if (!items.length) throw httpError(400, 'A venda precisa de pelo menos um item');

  const sale = await runInTransaction((session) =>
    persistSale(
      { customer, items, discount, payments, cashReceived, notes, operator },
      session,
    ),
  );
  if (sale.status === 'paga') {
    await enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id }).catch((error) => {
      console.error('NFC-e pendente:', error.message);
    });
  }
  return Sale.findById(sale._id).populate('customer');
}

async function persistSale(payload, session) {
  const hasApprovedPayment = (payload.payments || []).some(
    (payment) => (payment.status || 'aprovado') === 'aprovado',
  );
  if (hasApprovedPayment) await requireOpenRegister(session);

  const sale = new Sale({
    number: await nextNumber('sale', 'VD', 5, session),
    customer: payload.customer,
    items: [],
    discount: assertCents(payload.discount, 'desconto'),
    payments: [],
    cashReceived: assertCents(payload.cashReceived, 'valor recebido'),
    notes: payload.notes,
    operator: payload.operator,
    status: 'aberta',
  });

  await sale.save({ session: session || undefined });

  const finish = async () => {
    for (const raw of payload.items) {
      const product = await Product.findById(raw.product).session(session || undefined);
      if (!product) throw httpError(404, 'Produto não encontrado na venda');
      if (!product.active) throw httpError(400, `${product.name} está inativo`);

      const quantity = raw.quantity;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw httpError(400, 'Quantidade do item deve ser inteira e positiva');
      }

      const unitPrice = raw.unitPrice ?? product.salePrice;
      assertCents(unitPrice, 'preço de venda do item');
      const total = multiplyCents(unitPrice, quantity);

      const { movement } = await applyStockMovement({
        productId: product._id,
        type: 'venda',
        direction: 'saida',
        quantity,
        referenceType: 'sale',
        referenceId: sale._id,
        notes: `Venda ${sale.number}`,
        operator: payload.operator,
        unitCost: product.costPrice,
        unitPrice,
        session,
      });

      sale.items.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        category: product.category || '',
        quantity,
        unitCost: product.costPrice,
        unitPrice,
        total,
        stockMovement: movement._id,
      });
    }

    for (const payment of payload.payments) {
      assertCents(payment.amount, 'pagamento');
      sale.payments.push({
        method: payment.method,
        amount: payment.amount,
        status: payment.status || 'aprovado',
        mercadoPagoId: payment.mercadoPagoId || '',
        notes: payment.notes || '',
      });
    }

    recalcSaleTotals(sale);

    if (sale.cashReceived > 0) {
      sale.change = Math.max(0, subtractCents(sale.cashReceived, sale.total));
    }

    if (sale.paidAmount >= sale.total && sale.total >= 0) {
      sale.status = 'paga';
    }

    await sale.save({ session: session || undefined });

    for (const payment of sale.payments) {
      if (payment.status !== 'aprovado') continue;
      await registerLedgerMovement({
        type: 'venda',
        method: payment.method,
        amount: payment.amount,
        notes: `Venda ${sale.number}`,
        referenceId: sale._id,
        session,
      });
    }

    return sale;
  };

  if (session) return finish();

  try {
    return await finish();
  } catch (error) {
    await compensateStandaloneSale(sale, payload.operator, error.message).catch(() => undefined);
    throw error;
  }
}

async function compensateStandaloneSale(sale, operator, reason) {
  const movements = await StockMovement.find({
    referenceType: 'sale',
    referenceId: sale._id,
    type: 'venda',
    direction: 'saida',
  });

  for (const movement of movements) {
    await applyStockMovement({
      productId: movement.product,
      type: 'venda_cancelada',
      direction: 'entrada',
      quantity: movement.quantity,
      referenceType: 'sale',
      referenceId: sale._id,
      notes: `Rollback automático: ${reason}`,
      operator,
      unitCost: movement.unitCost,
      unitPrice: movement.unitPrice,
    });
  }

  await reverseLedgerForReference(sale._id);

  const persisted = await Sale.findById(sale._id);
  if (!persisted) return;
  persisted.status = 'cancelada';
  persisted.notes = [persisted.notes, `Rollback automático: ${reason}`].filter(Boolean).join(' | ');
  await persisted.save();
}

export async function cancelSale(saleId, { operator = 'sistema', notes = '', silent = false } = {}) {
  const sale = await runInTransaction(async (session) => {
    const current = await Sale.findById(saleId).session(session || undefined);
    if (!current) {
      if (silent) return null;
      throw httpError(404, 'Venda não encontrada');
    }
    if (current.status === 'cancelada') return current;
    if (current.status === 'devolvida') {
      throw httpError(400, 'Venda já devolvida. Use o histórico de devolução.');
    }

    for (const item of current.items) {
      const remaining = item.quantity - (item.returnedQuantity || 0);
      if (remaining <= 0) continue;
      await applyStockMovement({
        productId: item.product,
        type: 'venda_cancelada',
        direction: 'entrada',
        quantity: remaining,
        referenceType: 'sale',
        referenceId: current._id,
        notes: `Estorno ${current.number}${notes ? ` — ${notes}` : ''}`,
        operator,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
        session,
      });
    }

    current.status = 'cancelada';
    current.notes = [current.notes, notes].filter(Boolean).join(' | ');
    await current.save({ session: session || undefined });

    if (!silent) {
      await reverseLedgerForReference(current._id, session);
    }
    return current;
  });

  if (sale && !silent) {
    await cancelAuthorizedFor('sale', sale._id, notes || 'Cancelamento da venda no BikeGer.').catch((error) => {
      console.error('Cancelamento NFC-e:', error.message);
    });
  }

  return sale ? Sale.findById(sale._id).populate('customer') : sale;
}

export async function returnSale(saleId, { items = [], reason = '', method, operator = 'balcão' } = {}) {
  if (!items.length) throw httpError(400, 'Informe as peças a devolver');
  if (!reason.trim()) throw httpError(400, 'Informe o motivo da devolução');

  const sale = await runInTransaction(async (session) => {
    const current = await Sale.findById(saleId).session(session || undefined);
    if (!current) throw httpError(404, 'Venda não encontrada');
    if (current.status === 'cancelada') throw httpError(400, 'Venda cancelada não aceita devolução');
    if (current.status === 'devolvida') throw httpError(400, 'Esta venda já foi devolvida por completo');

    const returnedLines = [];
    let refund = 0;

    for (const raw of items) {
      const line = current.items.id(raw.itemId) || current.items.find((item) => String(item.product) === String(raw.product));
      if (!line) throw httpError(404, 'Item da venda não encontrado');
      const quantity = raw.quantity;
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw httpError(400, 'Quantidade devolvida deve ser inteira e positiva');
      }
      const open = line.quantity - (line.returnedQuantity || 0);
      if (quantity > open) {
        throw httpError(400, `${line.name}: só restam ${open} para devolver`);
      }

      await applyStockMovement({
        productId: line.product,
        type: 'devolucao',
        direction: 'entrada',
        quantity,
        referenceType: 'return',
        referenceId: current._id,
        notes: `Devolução ${current.number} — ${reason}`,
        operator,
        unitCost: line.unitCost,
        unitPrice: line.unitPrice,
        session,
      });

      line.returnedQuantity = (line.returnedQuantity || 0) + quantity;
      const lineTotal = multiplyCents(line.unitPrice, quantity);
      refund = addCents(refund, lineTotal);
      returnedLines.push({
        product: line.product,
        sku: line.sku,
        name: line.name,
        quantity,
        unitPrice: line.unitPrice,
        total: lineTotal,
      });
    }

    if (current.discount && current.subtotal) {
      const share = Math.floor((current.discount * refund) / current.subtotal);
      refund = subtractCents(refund, share);
    }

    const refundMethod = method || current.payments.find((payment) => payment.status === 'aprovado')?.method || 'dinheiro';
    current.returns.push({
      items: returnedLines,
      amount: refund,
      reason,
      method: refundMethod,
    });

    const fullyReturned = current.items.every((item) => (item.returnedQuantity || 0) >= item.quantity);
    if (fullyReturned) current.status = 'devolvida';

    current.notes = [current.notes, `Devolução: ${reason}`].filter(Boolean).join(' | ');
    await current.save({ session: session || undefined });

    await registerLedgerMovement({
      type: 'estorno',
      method: refundMethod,
      amount: refund,
      notes: `Devolução ${current.number}`,
      referenceId: current._id,
      session,
    });

    return { sale: current, fullyReturned, reason };
  });

  if (sale.fullyReturned) {
    await cancelAuthorizedFor('sale', sale.sale._id, reason).catch((error) => {
      console.error('Cancelamento NFC-e na devolução:', error.message);
    });
  }

  return Sale.findById(sale.sale._id).populate('customer');
}
