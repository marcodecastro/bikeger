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
import { can } from '../utils/roles.js';
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

    const canSeeSales = can(req.user?.role, 'sales');

    const [todayKpi, openOrders, workshopCounts, lowStock, customers, register, recentSales, recentOrders, todayMargin, monthMargin, pendingNotices, pendingApplyCount, settings] =
      await Promise.all([
        canSeeSales ? todaySalesKpi(start) : { salesCount: 0, revenue: 0, cost: 0 },
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
        canSeeSales ? getOpenRegister() : null,
        canSeeSales
          ? Sale.find({ status: { $ne: 'cancelada' } }).sort({ createdAt: -1 }).limit(6).populate('customer')
          : [],
        WorkOrder.find().sort({ updatedAt: -1 }).limit(6).populate('customer').populate('bike'),
        canSeeSales ? marginByCategory({ from: start }) : [],
        canSeeSales ? marginByCategory({ from: monthStart }) : [],
        listNotices({ status: 'pendente' }),
        canSeeSales ? countOpenPaymentApplyFailures() : 0,
        getSettings(),
      ]);

    const waitingParts = await listStaleWaitingParts(settings.waitingPartsDays || 3);

    res.json(
      hideCostIfNeeded(
        {
          today: {
            salesCount: todayKpi.salesCount,
            revenue: todayKpi.revenue,
            estimatedProfit: subtractCents(todayKpi.revenue, todayKpi.cost),
          },
          customers,
          lowStock,
          openOrders,
          openOrderCount: workshopCounts.openOrderCount,
          workshop: workshopCounts.statusCount,
          register,
          recentSales,
          recentOrders,
          marginByCategory: todayMargin,
          monthMarginByCategory: monthMargin,
          pendingNotices,
          pendingApplyCount,
          waitingParts,
          waitingPartsDays: settings.waitingPartsDays || 3,
        },
        req.user,
      ),
    );
  }),
);
