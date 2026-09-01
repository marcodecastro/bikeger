import mongoose from 'mongoose';

export const MOVEMENT_TYPES = [
  'compra',
  'ajuste',
  'venda',
  'venda_cancelada',
  'os',
  'os_estorno',
  'devolucao',
  'reserva',
  'reserva_liberada',
];

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true, enum: MOVEMENT_TYPES },
    direction: { type: String, required: true, enum: ['entrada', 'saida'] },
    quantity: { type: Number, required: true },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    referenceType: {
      type: String,
      enum: ['sale', 'workOrder', 'purchase', 'adjustment', 'return', null],
      default: null,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    notes: { type: String, default: '' },
    operator: { type: String, default: 'sistema' },
  },
  { timestamps: true },
);

stockMovementSchema.index({ createdAt: -1 });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
