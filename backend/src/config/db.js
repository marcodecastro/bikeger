import mongoose from 'mongoose';
import { redactMongoUri } from '../utils/security.js';
import { refreshTransactionSupport } from '../utils/transaction.js';

export async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bikeger';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  const support = await refreshTransactionSupport();
  console.log(
    'MongoDB conectado:',
    redactMongoUri(uri),
    support.transactions
      ? `(transações ativas${support.setName ? `, replica ${support.setName}` : ''})`
      : '(standalone — venda/OS usam compensação; suba com docker compose para replica set)',
  );
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
