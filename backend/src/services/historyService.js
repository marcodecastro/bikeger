import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { Bike } from '../models/Bike.js';
import { addCents } from '../utils/money.js';

export async function customerHistory(customerId) {
  const [bikes, sales, orders] = await Promise.all([
    Bike.find({ customer: customerId }).sort({ createdAt: -1 }),
    Sale.find({ customer: customerId, status: { $ne: 'cancelada' } }).sort({ createdAt: -1 }),
    WorkOrder.find({ customer: customerId }).populate('bike').sort({ createdAt: -1 }),
  ]);

  const salesTotal = sales.reduce((sum, sale) => addCents(sum, sale.total), 0);
  const ordersTotal = orders
    .filter((order) => order.status !== 'cancelada')
    .reduce((sum, order) => addCents(sum, order.total), 0);

  return {
    bikes,
    sales,
    orders,
    lifetimeValue: addCents(salesTotal, ordersTotal),
    salesTotal,
    ordersTotal,
    visitCount: sales.length + orders.length,
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
