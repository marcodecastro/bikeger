import { Router } from 'express';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { Sale } from '../models/Sale.js';
import { Bike } from '../models/Bike.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hideCostIfNeeded } from '../utils/hideCost.js';
import { searchRegex } from '../utils/searchRegex.js';

export const searchRouter = Router();

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      res.json({ products: [], customers: [], orders: [], sales: [], bikes: [] });
      return;
    }

    const rx = searchRegex(q);
    if (!rx) {
      res.json({ products: [], customers: [], orders: [], sales: [], bikes: [] });
      return;
    }
    const [products, customers, orders, sales, bikes] = await Promise.all([
      Product.find({ $or: [{ name: rx }, { sku: rx }, { barcode: rx }] }).limit(8),
      Customer.find({ $or: [{ name: rx }, { phone: rx }, { document: rx }] }).limit(6),
      WorkOrder.find({ number: rx }).populate('customer').limit(5),
      Sale.find({ number: rx }).populate('customer').limit(5),
      Bike.find({ $or: [{ brand: rx }, { model: rx }, { serialNumber: rx }] })
        .populate('customer')
        .limit(5),
    ]);

    res.json(
      hideCostIfNeeded(
        {
          products,
          customers,
          orders,
          sales: req.user?.role === 'mecanico' ? [] : sales,
          bikes,
        },
        req.user,
      ),
    );
  }),
);
