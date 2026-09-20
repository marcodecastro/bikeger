import mongoose from 'mongoose';

const paymentApplyFailureSchema = new mongoose.Schema(
  {
    kind: { type: String, default: 'payment_apply_failed' },
    mpPaymentId: { type: String, required: true, index: true },
    relatedType: { type: String, default: '' },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    localPaymentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    message: { type: String, default: '' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    attempts: { type: Number, default: 1 },
    lastErrorAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

paymentApplyFailureSchema.index(
  { mpPaymentId: 1 },
  {
    unique: true,
    name: 'one_open_payment_apply_failed',
    partialFilterExpression: { status: 'open' },
  },
);

export const PaymentApplyFailure = mongoose.model('PaymentApplyFailure', paymentApplyFailureSchema);
