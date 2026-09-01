import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tradeName: { type: String, default: '' },
    document: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    city: { type: String, default: '' },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supplierSchema.index({ name: 'text' });

export const Supplier = mongoose.model('Supplier', supplierSchema);
