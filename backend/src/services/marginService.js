import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';

export async function marginByCategory({ from, to } = {}) {
  const filter = { status: { $in: ['paga', 'devolvida'] } };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const rows = await Sale.aggregate([
    { $match: filter },
    { $unwind: '$items' },
    {
      $addFields: {
        qty: { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] },
      },
    },
    { $match: { qty: { $gt: 0 } } },
    {
      $lookup: {
        from: Product.collection.collectionName,
        localField: 'items.product',
        foreignField: '_id',
        as: 'productDoc',
      },
    },
    {
      $addFields: {
        category: {
          $let: {
            vars: {
              itemCat: { $ifNull: ['$items.category', ''] },
              productCat: { $ifNull: [{ $arrayElemAt: ['$productDoc.category', 0] }, ''] },
            },
            in: {
              $cond: [
                { $gt: [{ $strLenCP: '$$itemCat' }, 0] },
                '$$itemCat',
                {
                  $cond: [
                    { $gt: [{ $strLenCP: '$$productCat' }, 0] },
                    '$$productCat',
                    'Sem categoria',
                  ],
                },
              ],
            },
          },
        },
        revenue: { $multiply: ['$items.unitPrice', '$qty'] },
        cost: { $multiply: ['$items.unitCost', '$qty'] },
      },
    },
    {
      $group: {
        _id: '$category',
        revenue: { $sum: '$revenue' },
        cost: { $sum: '$cost' },
        quantity: { $sum: '$qty' },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        revenue: 1,
        cost: 1,
        profit: { $subtract: ['$revenue', '$cost'] },
        quantity: 1,
      },
    },
    { $sort: { profit: -1 } },
  ]);

  return rows;
}
