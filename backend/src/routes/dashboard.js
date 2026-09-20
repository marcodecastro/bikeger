import { Router } from 'express';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { Customer } from '../models/Customer.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { subtractCents } from '../utils/money.js';
import { getOpenRegister } from '../services/cashService.js';
import { marginByCategory } from '../services/marginService.js';
import { listNotices } from '../services/notifyService.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { todaySalesKpi } from '../utils/todaySalesKpi.js';
import { listStaleWaitingParts, workshopStatusCounts } from '../services/workOrderService.js';
import { countOpenPaymentApplyFailures } from '../services/paymentOutbox.js';
import { getSettings } from '../models/Settings.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);

    const [todayKpi, openOrders, workshopCounts, lowStock, customers, register, recentSales, recentOrders, todayMargin, monthMargin, pendingNotices, pendingApplyCount, settings] =
      await Promise.all([
        todaySalesKpi(start),
        WorkOrder.find({ status: { $nin: ['entregue', 'cancelada'] } })
          .populate('customer')
          .populate('bike')
          .sort({ createdAt: -1 })
          .limit(12),
        workshopStatusCounts(),
        Product.find({
          active: true,
          $expr: { $lte: ['$currentStock', '$minStock'] },
        })
          .sort({ currentStock: 1 })
          .limit(50),
        Customer.countDocuments(),
        getOpenRegister(),
        Sale.find({ status: { $ne: 'cancelada' } }).sort({ createdAt: -1 }).limit(6).populate('customer'),
        WorkOrder.find().sort({ updatedAt: -1 }).limit(6).populate('customer').populate('bike'),
        marginByCategory({ from: start }),
        marginByCategory({ from: monthStart }),
        listNotices({ status: 'pendente' }),
        countOpenPaymentApplyFailures(),
        getSettings(),
      ]);

    const waitingParts = await listStaleWaitingParts(settings.waitingPartsDays || 3);

    const isMechanic = req.user?.role === 'mecanico';

    res.json(
      hideCostIfNeeded(
        {
          today: isMechanic
            ? { salesCount: 0, revenue: 0, estimatedProfit: 0 }
            : {
                salesCount: todayKpi.salesCount,
                revenue: todayKpi.revenue,
                estimatedProfit: subtractCents(todayKpi.revenue, todayKpi.cost),
              },
          customers,
          lowStock,
          openOrders,
          openOrderCount: workshopCounts.openOrderCount,
          workshop: workshopCounts.statusCount,
          register: isMechanic ? null : register,
          recentSales: isMechanic ? [] : recentSales,
          recentOrders,
          marginByCategory: isMechanic ? [] : todayMargin,
          monthMarginByCategory: isMechanic ? [] : monthMargin,
          pendingNotices,
          pendingApplyCount: isMechanic ? 0 : pendingApplyCount,
          waitingParts,
          waitingPartsDays: settings.waitingPartsDays || 3,
        },
        req.user,
      ),
    );
  }),
);
