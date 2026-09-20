import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    actorLogin: { type: String, default: '' },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    targetLogin: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
