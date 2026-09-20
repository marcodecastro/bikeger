import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { Purchase } from '../models/Purchase.js';
import { subtractCents } from '../utils/money.js';
import { workshopStatusCounts } from './workOrderService.js';

function monthRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }
  return { from, to, year: y, month: m };
}

export async function monthReport({ year, month } = {}) {
  const range = monthRange(year, month);
  const { from, to } = range;

  const [salesRow] = await Sale.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, status: 'paga' } },
    {
      $group: {
        _id: null,
        salesCount: { $sum: 1 },
        revenue: { $sum: '$total' },
        cost: {
          $sum: {
            $reduce: {
              input: '$items',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $multiply: [
                      { $ifNull: ['$$this.unitCost', 0] },
                      {
                        $subtract: [
                          { $ifNull: ['$$this.quantity', 0] },
                          { $ifNull: ['$$this.returnedQuantity', 0] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
  ]);

  const [osRow] = await WorkOrder.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        opened: { $sum: 1 },
        revenue: {
          $sum: {
            $reduce: {
              input: {
                $filter: {
                  input: { $ifNull: ['$payments', []] },
                  as: 'payment',
                  cond: { $eq: ['$$payment.status', 'aprovado'] },
                },
              },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
            },
          },
        },
        delivered: {
          $sum: { $cond: [{ $eq: ['$status', 'entregue'] }, 1, 0] },
        },
      },
    },
  ]);

  const workshop = await workshopStatusCounts();

  const [stock] = await Product.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: null,
        skuCount: { $sum: 1 },
        units: { $sum: '$currentStock' },
        value: {
          $sum: { $multiply: [{ $ifNull: ['$currentStock', 0] }, { $ifNull: ['$costPrice', 0] }] },
        },
      },
    },
  ]);

  const [outRow] = await StockMovement.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        direction: 'saida',
        type: { $in: ['venda', 'os'] },
      },
    },
    { $group: { _id: null, qty: { $sum: '$quantity' } } },
  ]);

  const [purchaseRow] = await Purchase.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$itemsTotal' } } },
  ]);

  const salesRevenue = salesRow?.revenue || 0;
  const salesCost = salesRow?.cost || 0;
  const stockUnits = stock?.units || 0;
  const outQty = outRow?.qty || 0;

  return {
    year: range.year,
    month: range.month,
    from: from.toISOString(),
    to: to.toISOString(),
    sales: {
      count: salesRow?.salesCount || 0,
      revenue: salesRevenue,
      cost: salesCost,
      margin: subtractCents(salesRevenue, salesCost),
    },
    workshop: {
      opened: osRow?.opened || 0,
      delivered: osRow?.delivered || 0,
      revenue: osRow?.revenue || 0,
      openNow: workshop.openOrderCount,
      byStatus: workshop.statusCount,
    },
    stock: {
      skuCount: stock?.skuCount || 0,
      units: stockUnits,
      value: stock?.value || 0,
      outQty,
      giro: stockUnits > 0 ? outQty / stockUnits : 0,
    },
    purchases: {
      count: purchaseRow?.count || 0,
      total: purchaseRow?.total || 0,
    },
  };
}
