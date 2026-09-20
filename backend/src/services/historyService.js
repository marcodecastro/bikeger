import mongoose from 'mongoose';
import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { Bike } from '../models/Bike.js';
import { addCents } from '../utils/money.js';
import { listLimit, MAX_LIST_LIMIT } from '../utils/listLimit.js';

export const DEFAULT_HISTORY_LIMIT = 50;

function asObjectId(value) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function hasMore(loaded, total) {
  return loaded < total && loaded < MAX_LIST_LIMIT;
}

export async function customerHistory(customerId, { salesLimit, ordersLimit } = {}) {
  const salesCap = listLimit(salesLimit, DEFAULT_HISTORY_LIMIT);
  const ordersCap = listLimit(ordersLimit, DEFAULT_HISTORY_LIMIT);
  const customer = asObjectId(customerId);

  const [bikes, sales, orders, salesAgg, ordersAgg] = await Promise.all([
    Bike.find({ customer }).sort({ createdAt: -1 }),
    Sale.find({ customer, status: { $ne: 'cancelada' } }).sort({ createdAt: -1 }).limit(salesCap),
    WorkOrder.find({ customer }).populate('bike').sort({ createdAt: -1 }).limit(ordersCap),
    Sale.aggregate([
      { $match: { customer, status: { $ne: 'cancelada' } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    WorkOrder.aggregate([
      { $match: { customer } },
      {
        $group: {
          _id: null,
          total: { $sum: { $cond: [{ $ne: ['$status', 'cancelada'] }, '$total', 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const salesTotal = salesAgg[0]?.total || 0;
  const ordersTotal = ordersAgg[0]?.total || 0;
  const salesCount = salesAgg[0]?.count || 0;
  const ordersCount = ordersAgg[0]?.count || 0;

  return {
    bikes,
    sales,
    orders,
    lifetimeValue: addCents(salesTotal, ordersTotal),
    salesTotal,
    ordersTotal,
    visitCount: salesCount + ordersCount,
    salesCount,
    ordersCount,
    salesHasMore: hasMore(sales.length, salesCount),
    ordersHasMore: hasMore(orders.length, ordersCount),
  };
}

export async function bikeHistory(bikeId) {
  const orders = await WorkOrder.find({ bike: bikeId }).populate('customer').sort({ createdAt: -1 });

  const partsReplaced = [];
  for (const order of orders) {
    if (order.status === 'cancelada') continue;
    for (const part of order.parts) {
      partsReplaced.push({
        date: order.createdAt,
        workOrder: order.number,
        sku: part.sku,
        name: part.name,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
      });
    }
  }

  const timeline = orders.map((order) => ({
    id: order._id,
    number: order.number,
    status: order.status,
    date: order.createdAt,
    deliveredAt: order.deliveredAt,
    complaint: order.complaint,
    diagnosis: order.diagnosis,
    mechanic: order.mechanic,
    services: order.services.map((item) => item.name),
    parts: order.parts.map((item) => `${item.quantity}x ${item.name}`),
    total: order.total,
  }));

  return {
    orders,
    partsReplaced,
    timeline,
    openOrders: orders.filter((order) => !['entregue', 'cancelada'].includes(order.status)).length,
  };
}
