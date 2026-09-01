import mongoose from 'mongoose';
import { assertCents } from '../utils/money.js';

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    barcode: { type: String, default: '', trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, trim: true, index: true },
    brand: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    unit: { type: String, default: 'UN' },
    costPrice: { type: Number, required: true, default: 0 },
    salePrice: { type: Number, required: true, default: 0 },
    currentStock: { type: Number, required: true, default: 0 },
    reservedStock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    ncm: { type: String, default: '87149990' },
    cfop: { type: String, default: '5102' },
    icmsOrigin: { type: String, default: '0' },
    icmsCst: { type: String, default: '102' },
    location: { type: String, default: '' },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    active: { type: Boolean, default: true, index: true },
    images: { type: [String], default: [] },
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', sku: 'text', barcode: 'text', brand: 'text' });

productSchema.pre('validate', function validateMoney() {
  assertCents(this.costPrice, 'preço de custo');
  assertCents(this.salePrice, 'preço de venda');
  if (!Number.isInteger(this.currentStock)) {
    throw new Error('estoqueAtual deve ser um inteiro');
  }
  if (!Number.isInteger(this.minStock)) {
    throw new Error('estoque mínimo deve ser um inteiro');
  }
  if (!Number.isInteger(this.reservedStock || 0) || this.reservedStock < 0) {
    throw new Error('estoque reservado deve ser um inteiro não negativo');
  }
});

productSchema.virtual('availableStock').get(function availableStock() {
  return (this.currentStock || 0) - (this.reservedStock || 0);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export const Product = mongoose.model('Product', productSchema);
