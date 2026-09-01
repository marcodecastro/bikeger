import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    document: { type: String, default: '', trim: true },
    address: {
      street: { type: String, default: '' },
      number: { type: String, default: '' },
      neighborhood: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customerSchema.index({ name: 'text', phone: 'text', document: 'text', email: 'text' });

export const Customer = mongoose.model('Customer', customerSchema);
