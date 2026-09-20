import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: true },
);

const purchaseSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    status: { type: String, enum: ['recebida'], default: 'recebida' },
    notes: { type: String, default: '' },
    items: { type: [purchaseItemSchema], default: [] },
    itemsTotal: { type: Number, default: 0 },
    operator: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

purchaseSchema.index({ createdAt: -1 });

export const Purchase = mongoose.model('Purchase', purchaseSchema);
