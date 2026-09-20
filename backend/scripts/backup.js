#!/usr/bin/env node
import 'dotenv/config';
import { runBackup } from '../src/services/backupService.js';

const result = await runBackup({ reason: 'cli' });
if (result.skipped) {
  console.log(`Backup pulado (${result.reason}).`);
  process.exit(0);
}
console.log(`Backup gravado em ${result.out}`);
