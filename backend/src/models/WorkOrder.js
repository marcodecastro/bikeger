import mongoose from 'mongoose';

export const WORK_ORDER_STATUSES = [
  'aberta',
  'diagnostico',
  'aguardando_pecas',
  'em_servico',
  'pronta',
  'entregue',
  'cancelada',
];

const serviceItemSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    total: { type: Number, required: true },
  },
  { _id: true },
);

const partItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    stockStatus: { type: String, enum: ['reservada', 'consumida'], default: 'reservada' },
    stockMovement: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement', default: null },
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
  },
  { _id: true, timestamps: true },
);

const workOrderSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    bike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', required: true },
    status: { type: String, enum: WORK_ORDER_STATUSES, default: 'aberta', index: true },
    complaint: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    mechanic: { type: String, default: '' },
    services: { type: [serviceItemSchema], default: [] },
    parts: { type: [partItemSchema], default: [] },
    laborTotal: { type: Number, default: 0 },
    partsTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    paidAmount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    openedAt: { type: Date, default: Date.now },
    readyAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null, index: true },
    scheduleKind: {
      type: String,
      enum: ['diagnostico', 'servico', 'retirada'],
      default: 'servico',
    },
    readyNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workOrderSchema.index({ customer: 1, createdAt: -1 });
workOrderSchema.index({ bike: 1, createdAt: -1 });

export const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);
