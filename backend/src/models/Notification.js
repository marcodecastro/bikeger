import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['os_pronta'], default: 'os_pronta', index: true },
    workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
    status: { type: String, enum: ['pendente', 'enviado', 'sem_telefone'], default: 'pendente', index: true },
    message: { type: String, default: '' },
    waUrl: { type: String, default: '' },
    phone: { type: String, default: '' },
    provider: { type: String, enum: ['wa.me', 'cloud'], default: 'wa.me' },
    cloudMessageId: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Notification = mongoose.model('Notification', notificationSchema);
