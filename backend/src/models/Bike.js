import mongoose from 'mongoose';

const bikeSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, default: null },
    color: { type: String, default: '' },
    serialNumber: { type: String, default: '', index: true },
    frameSize: { type: String, default: '' },
    type: {
      type: String,
      enum: ['mtb', 'speed', 'urbana', 'eletrica', 'infantil', 'gravel', 'bmx', 'outra'],
      default: 'mtb',
    },
    notes: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
  },
  { timestamps: true },
);

bikeSchema.index({ brand: 'text', model: 'text', serialNumber: 'text' });

export const Bike = mongoose.model('Bike', bikeSchema);
