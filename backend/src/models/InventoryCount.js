import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    barcode: { type: String, default: '' },
    systemQty: { type: Number, required: true },
    countedQty: { type: Number, required: true, default: 0 },
  },
  { _id: true },
);

const inventoryCountSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    status: { type: String, enum: ['aberta', 'aplicada', 'cancelada'], default: 'aberta', index: true },
    notes: { type: String, default: '' },
    items: { type: [inventoryItemSchema], default: [] },
    operator: { type: String, default: '' },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inventoryCountSchema.index({ createdAt: -1 });
inventoryCountSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'aberta' }, name: 'one_open_inventory' },
);

export const InventoryCount = mongoose.model('InventoryCount', inventoryCountSchema);
