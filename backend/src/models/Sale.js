import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: '' },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    stockMovement: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement', default: null },
    returnedQuantity: { type: Number, default: 0 },
  },
  { _id: true },
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'mercado_pago'],
      required: true,
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pendente', 'aprovado', 'recusado'], default: 'aprovado' },
    mercadoPagoId: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: true, timestamps: true },
);

const saleSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    items: { type: [saleItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    paidAmount: { type: Number, default: 0 },
    cashReceived: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    status: { type: String, enum: ['aberta', 'paga', 'cancelada', 'devolvida'], default: 'paga' },
    returns: {
      type: [
        {
          items: [
            {
              product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
              sku: String,
              name: String,
              quantity: Number,
              unitPrice: Number,
              total: Number,
            },
          ],
          amount: { type: Number, required: true },
          reason: { type: String, default: '' },
          method: { type: String, default: 'dinheiro' },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    notes: { type: String, default: '' },
    operator: { type: String, default: 'balcão' },
  },
  { timestamps: true },
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ customer: 1, createdAt: -1 });

export const Sale = mongoose.model('Sale', saleSchema);
