import mongoose from 'mongoose';

const fiscalDocumentSchema = new mongoose.Schema(
  {
    relatedType: { type: String, enum: ['sale', 'workOrder'], required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, default: 'nfce' },
    status: {
      type: String,
      enum: ['pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada'],
      default: 'pendente',
      index: true,
    },
    amount: { type: Number, required: true },
    number: { type: String, default: '' },
    series: { type: String, default: '' },
    accessKey: { type: String, default: '' },
    protocol: { type: String, default: '' },
    provider: { type: String, default: 'interno' },
    errorMessage: { type: String, default: '' },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
    danfeUrl: { type: String, default: '' },
    qrcodeUrl: { type: String, default: '' },
    sefazStatus: { type: String, default: '' },
  },
  { timestamps: true },
);

fiscalDocumentSchema.index(
  { relatedType: 1, relatedId: 1 },
  {
    unique: true,
    name: 'one_open_nfce_per_document',
    partialFilterExpression: { status: { $in: ['pendente', 'processando', 'autorizada'] } },
  },
);

export const FiscalDocument = mongoose.model('FiscalDocument', fiscalDocumentSchema);
