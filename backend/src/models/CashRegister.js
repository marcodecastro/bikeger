import mongoose from 'mongoose';

const PAYMENT_METHODS = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'mercado_pago'];

const cashMovementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['sangria', 'suprimento', 'venda', 'os', 'estorno'], required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: 'dinheiro' },
    amount: { type: Number, required: true },
    notes: { type: String, default: '' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const cashRegisterSchema = new mongoose.Schema(
  {
    openedAt: { type: Date, required: true, default: Date.now },
    closedAt: { type: Date, default: null },
    openingAmount: { type: Number, required: true, default: 0 },
    countedCash: { type: Number, default: 0 },
    expectedCash: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    status: { type: String, enum: ['aberto', 'fechado'], default: 'aberto', index: true },
    movements: { type: [cashMovementSchema], default: [] },
    operator: { type: String, default: 'caixa' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

cashRegisterSchema.index(
  { status: 1 },
  {
    unique: true,
    name: 'one_open_register',
    partialFilterExpression: { status: 'aberto' },
  },
);

export const CashRegister = mongoose.model('CashRegister', cashRegisterSchema);
export { PAYMENT_METHODS };
