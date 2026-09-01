import { Counter } from '../models/Counter.js';

export async function nextNumber(name, prefix, pad = 5, session = null) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session: session || undefined },
  );
  return `${prefix}-${String(doc.seq).padStart(pad, '0')}`;
}
