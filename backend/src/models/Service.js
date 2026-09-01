import mongoose from 'mongoose';
import { assertCents } from '../utils/money.js';

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Revisão', trim: true },
    price: { type: Number, required: true, default: 0 },
    estimatedMinutes: { type: Number, default: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

serviceSchema.pre('validate', function validateMoney() {
  assertCents(this.price, 'preço do serviço');
});

export const Service = mongoose.model('Service', serviceSchema);
