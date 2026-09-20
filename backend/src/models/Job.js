import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'running', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 8 },
    runAfter: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: '' },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, runAfter: 1 });

export const Job = mongoose.model('Job', jobSchema);
