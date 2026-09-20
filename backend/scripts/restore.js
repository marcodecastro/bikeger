#!/usr/bin/env node
import 'dotenv/config';
import { runRestore } from '../src/services/backupService.js';

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('Uso: npm run restore -- backend/backups/bikeger-AAAA-MM-DDTHH-MM-SS');
  process.exit(1);
}

await runRestore(dumpPath);
console.log('Restore concluído. Confira o painel e um caixa fechado recente.');
