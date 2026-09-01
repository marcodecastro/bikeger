import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    provider: { type: String, default: 'mercado_pago' },
    preferenceId: { type: String, default: '' },
    paymentId: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    amount: { type: Number, required: true },
    relatedType: { type: String, enum: ['sale', 'workOrder'], required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    qrCode: { type: String, default: '' },
    qrCodeBase64: { type: String, default: '' },
    ticketUrl: { type: String, default: '' },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentSchema.index(
  { paymentId: 1 },
  {
    unique: true,
    name: 'paymentId_unique_nonempty',
    partialFilterExpression: { paymentId: { $gt: '' } },
  },
);

paymentSchema.index(
  { relatedType: 1, relatedId: 1 },
  {
    unique: true,
    name: 'one_open_charge_per_document',
    partialFilterExpression: { status: { $in: ['pending', 'in_process'] } },
  },
);

export const Payment = mongoose.model('Payment', paymentSchema);
