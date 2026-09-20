import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema(
  {
    _id: { type: String },
    count: { type: Number, required: true, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false },
);

loginAttemptSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);
