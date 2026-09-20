import mongoose from 'mongoose';

export const CASH_MOVEMENT_TYPES = ['sangria', 'suprimento', 'venda', 'os', 'estorno'];
export const CASH_MOVEMENT_METHODS = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'mercado_pago'];

const cashMovementSchema = new mongoose.Schema(
  {
    registerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', required: true, index: true },
    type: { type: String, enum: CASH_MOVEMENT_TYPES, required: true, index: true },
    method: { type: String, enum: CASH_MOVEMENT_METHODS, default: 'dinheiro', index: true },
    amount: { type: Number, required: true },
    notes: { type: String, default: '' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    operator: { type: String, default: '' },
  },
  { timestamps: true },
);

cashMovementSchema.index({ createdAt: -1 });
cashMovementSchema.index({ registerId: 1, createdAt: -1 });

export const CashMovement = mongoose.model('CashMovement', cashMovementSchema);
