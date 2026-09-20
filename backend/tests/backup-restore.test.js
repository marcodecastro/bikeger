import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { Customer } from '../src/models/Customer.js';
import { Product } from '../src/models/Product.js';
import { Job } from '../src/models/Job.js';
import {
  assertRestoreConfirm,
  backupSourceLabel,
  decodeBackupArchive,
  encodeBackupArchive,
  restoreFromBuffer,
  runBackup,
  safeBackupName,
  RESTORE_CONFIRM,
} from '../src/services/backupService.js';

const uri = process.env.MONGODB_TEST_URI_BK || 'mongodb://127.0.0.1:27017/bikeger_test_bk';
let dir = '';

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'bikeger-bk-'));
  process.env.BACKUP_DIR = dir;
  await mongoose.connect(uri);
  await Promise.all([Customer.deleteMany({}), Product.deleteMany({}), Job.deleteMany({})]);
});

after(async () => {
  await mongoose.disconnect();
  await rm(dir, { recursive: true, force: true });
});

test('source do backup distingue localhost e Atlas', () => {
  assert.equal(backupSourceLabel('mongodb://127.0.0.1:27017/bikeger'), 'localhost');
  assert.equal(
    backupSourceLabel('mongodb+srv://u:p@cluster.mongodb.net/bikeger'),
    'cloud',
  );
});

test('nome de backup recusa path traversal', () => {
  assert.throws(() => safeBackupName('../secret.json.gz'), { status: 400 });
  assert.throws(() => safeBackupName('not-a-backup'), { status: 400 });
  const ok = safeBackupName('bikeger-2026-09-20T20-44-00.json.gz');
  assert.equal(ok.base, 'bikeger-2026-09-20T20-44-00.json.gz');
});

test('restore exige a palavra RESTAURAR', () => {
  assert.throws(() => assertRestoreConfirm('ok'), { status: 400 });
  assert.doesNotThrow(() => assertRestoreConfirm(RESTORE_CONFIRM));
});

test('dump e restore lógico recolocam cliente e ignoram jobs', async () => {
  const customer = await Customer.create({ name: 'Backup P3', document: '529.982.247-25' });
  await Product.create({
    sku: 'BK-1',
    barcode: '',
    name: 'Câmbio',
    category: 'Transmissão',
    costPrice: 1000,
    salePrice: 2000,
    currentStock: 2,
    minStock: 0,
    unit: 'UN',
  });
  await Job.create({ name: 'backup.daily', status: 'pending' });

  const created = await runBackup({ reason: 'manual' });
  assert.equal(created.skipped, false);
  assert.match(created.filename, /\.json\.gz$/);

  await Customer.deleteMany({});
  await Product.deleteMany({});
  await Job.deleteMany({});
  await Job.create({ name: 'keep-me', status: 'pending' });

  const { default: fs } = await import('node:fs/promises');
  const buffer = await fs.readFile(created.out);
  await restoreFromBuffer(buffer);

  const restored = await Customer.findOne({ name: 'Backup P3' });
  assert.ok(restored);
  assert.equal(restored.document, '52998224725');
  assert.equal(String(restored._id), String(customer._id));
  assert.equal(await Product.countDocuments({ sku: 'BK-1' }), 1);
  assert.equal(await Job.countDocuments({ name: 'keep-me' }), 1);
  assert.equal(await Job.countDocuments({ name: 'backup.daily' }), 0);
});

test('arquivo que não é backup do BikeGer é recusado', async () => {
  const fake = await encodeBackupArchive({ format: 'outro', collections: {} });
  await assert.rejects(() => decodeBackupArchive(fake), { status: 400 });
});

test('job automático continua pulado fora de produção', async () => {
  const result = await runBackup({ reason: 'job' });
  assert.equal(result.skipped, true);
  assert.ok(result.reason === 'test' || result.reason === 'dev');
});
