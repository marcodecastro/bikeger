import { WorkOrder } from '../models/WorkOrder.js';

export function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function weekFrom(anchor = new Date()) {
  const start = startOfDay(anchor);
  const weekday = start.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const from = addDays(start, mondayOffset);
  const to = addDays(from, 7);
  return { from, to };
}

export function dateKey(value) {
  const date = startOfDay(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function listAgenda({ from, to } = {}) {
  const range = from && to ? { from: startOfDay(from), to: startOfDay(to) } : weekFrom();
  const end = range.to;

  const [scheduled, unscheduledReady] = await Promise.all([
    WorkOrder.find({
      scheduledAt: { $gte: range.from, $lt: end },
      status: { $ne: 'cancelada' },
    })
      .populate('customer')
      .populate('bike')
      .sort({ scheduledAt: 1 }),
    WorkOrder.find({
      status: 'pronta',
      $or: [{ scheduledAt: null }, { scheduledAt: { $exists: false } }],
    })
      .populate('customer')
      .populate('bike')
      .sort({ readyAt: -1 }),
  ]);

  const days = [];
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(range.from, index);
    const key = dateKey(date);
    days.push({
      date: date.toISOString(),
      key,
      items: scheduled.filter((order) => dateKey(order.scheduledAt) === key),
    });
  }

  return {
    from: range.from.toISOString(),
    to: end.toISOString(),
    days,
    unscheduledReady,
  };
}
