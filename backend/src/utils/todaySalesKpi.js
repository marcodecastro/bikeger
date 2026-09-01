import { Sale } from '../models/Sale.js';

export async function todaySalesKpi(start) {
  const [row] = await Sale.aggregate([
    { $match: { createdAt: { $gte: start }, status: 'paga' } },
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
                      { $ifNull: ['$$this.quantity', 0] },
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

  return {
    salesCount: row?.salesCount || 0,
    revenue: row?.revenue || 0,
    cost: row?.cost || 0,
  };
}
