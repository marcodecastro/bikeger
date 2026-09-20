#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import { mongoUri } from '../src/config/db.js';
import { runBackup } from '../src/services/backupService.js';

await mongoose.connect(mongoUri());
try {
  const result = await runBackup({ reason: 'cli' });
  if (result.skipped) {
    console.log(`Backup pulado (${result.reason}).`);
    process.exitCode = 0;
  } else {
    console.log(`Backup gravado em ${result.out}${result.cloudUpload ? ' (cópia na nuvem)' : ''}`);
  }
} finally {
  await mongoose.disconnect();
}
