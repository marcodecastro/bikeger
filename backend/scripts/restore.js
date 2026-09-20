#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import { mongoUri } from '../src/config/db.js';
import { RESTORE_CONFIRM, runRestore } from '../src/services/backupService.js';

const dumpPath = process.argv[2];
const confirm = process.argv[3];
if (!dumpPath) {
  console.error(`Uso: npm run restore -- backups/bikeger-AAAA-MM-DDTHH-MM-SS.json.gz ${RESTORE_CONFIRM}`);
  process.exit(1);
}
if (confirm !== RESTORE_CONFIRM) {
  console.error(`Confirme com ${RESTORE_CONFIRM}. Isso substitui os dados do banco da MONGODB_URI.`);
  process.exit(1);
}

await mongoose.connect(mongoUri());
try {
  await runRestore(dumpPath);
  console.log('Restore concluído. Confira o painel e um caixa fechado recente.');
} finally {
  await mongoose.disconnect();
}
