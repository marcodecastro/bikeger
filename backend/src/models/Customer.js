import mongoose from 'mongoose';

export function normalizeCustomerDocument(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function applyDocumentNormalize(update) {
  if (!update || typeof update !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(update, 'document')) {
    update.document = normalizeCustomerDocument(update.document);
  }
  if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'document')) {
    update.$set.document = normalizeCustomerDocument(update.$set.document);
  }
}

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

customerSchema.pre('validate', function normalizeDocument() {
  this.document = normalizeCustomerDocument(this.document);
});

customerSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function normalizeDocumentUpdate() {
  applyDocumentNormalize(this.getUpdate());
});

customerSchema.index({ name: 'text', phone: 'text', document: 'text', email: 'text' });
customerSchema.index(
  { document: 1 },
  {
    unique: true,
    partialFilterExpression: { document: { $type: 'string', $gt: '' } },
    name: 'one_customer_document',
  },
);

export const Customer = mongoose.model('Customer', customerSchema);
