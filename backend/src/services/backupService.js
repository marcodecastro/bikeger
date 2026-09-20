import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { EJSON } from 'bson';
import mongoose from 'mongoose';
import { log, logError } from '../utils/logger.js';
import { mongoUri } from '../config/db.js';
import { isProduction } from '../utils/security.js';
import { httpError } from '../utils/asyncHandler.js';
import { fetchWithTimeout } from '../utils/fetchTimeout.js';
import { recordAudit } from './auditService.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const RETENTION_DAYS = 14;
export const RESTORE_CONFIRM = 'RESTAURAR';
export const BACKUP_FORMAT = 'bikeger-ejson-v1';
export const ARCHIVE_NAME_RE = /^bikeger-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.json(?:\.gz)?)?$/;
const SKIP_RESTORE = new Set(['jobs', 'loginattempts']);

export function backupDir() {
  return process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');
}

export { mongoUri };

export function backupSourceLabel(uri = mongoUri()) {
  const value = String(uri || '');
  if (/mongodb\+srv/i.test(value) || /\.mongodb\.net/i.test(value)) return 'cloud';
  if (/127\.0\.0\.1|localhost/i.test(value)) return 'localhost';
  return 'mongo';
}

export function cloudUploadConfigured() {
  return Boolean(String(process.env.BACKUP_CLOUD_PUT_URL || '').trim());
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function skipBackup(reason) {
  if (reason === 'manual' || reason === 'cli') return '';
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_BACKUP === 'true') return 'test';
  if (reason === 'job' && process.env.NODE_ENV !== 'production' && process.env.BACKUP_ON_CLOSE !== 'true') {
    return 'dev';
  }
  return '';
}

function nativeDb() {
  const db = mongoose.connection?.db;
  if (!db) throw httpError(503, 'MongoDB ainda não está conectado');
  return db;
}

export function assertRestoreConfirm(value) {
  if (String(value || '').trim() !== RESTORE_CONFIRM) {
    throw httpError(400, `Digite ${RESTORE_CONFIRM} para restaurar. Isso substitui os dados do banco conectado.`);
  }
}

export function safeBackupName(name) {
  const base = path.basename(String(name || ''));
  if (!ARCHIVE_NAME_RE.test(base)) {
    throw httpError(400, 'Arquivo de backup inválido');
  }
  const root = path.resolve(backupDir());
  const full = path.resolve(root, base);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (full !== root && !full.startsWith(prefix)) {
    throw httpError(400, 'Arquivo de backup inválido');
  }
  return { base, full };
}

async function pruneOldBackups(dir) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.name.startsWith('bikeger-')) continue;
    const full = path.join(dir, entry.name);
    try {
      const info = await stat(full);
      if (info.mtimeMs < cutoff) await rm(full, { recursive: true, force: true });
    } catch (error) {
      log('warn', 'Falha ao limpar backup antigo', { dir: full, message: error.message });
    }
  }
}

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${bin} saiu com código ${code}`));
    });
  });
}

async function listUserCollections(db) {
  const found = await db.listCollections({}, { nameOnly: true }).toArray();
  return found.map((item) => item.name).filter((name) => name && !name.startsWith('system.'));
}

export async function buildBackupPayload() {
  const db = nativeDb();
  const names = await listUserCollections(db);
  const collections = {};
  for (const name of names) {
    collections[name] = await db.collection(name).find({}).toArray();
  }
  return {
    format: BACKUP_FORMAT,
    createdAt: new Date(),
    source: backupSourceLabel(),
    collections,
  };
}

export async function encodeBackupArchive(payload) {
  const json = EJSON.stringify(payload, { relaxed: false });
  return gzipAsync(Buffer.from(json, 'utf8'));
}

export async function decodeBackupArchive(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const json = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
    ? (await gunzipAsync(bytes)).toString('utf8')
    : bytes.toString('utf8');
  const payload = EJSON.parse(json);
  if (!payload || payload.format !== BACKUP_FORMAT || typeof payload.collections !== 'object') {
    throw httpError(400, 'Este arquivo não é um backup do BikeGer');
  }
  return payload;
}

async function uploadToCloud(filename, bytes) {
  const template = String(process.env.BACKUP_CLOUD_PUT_URL || '').trim();
  if (!template) return { uploaded: false };
  const url = template.replaceAll('{filename}', encodeURIComponent(filename));
  const headers = { 'Content-Type': 'application/gzip' };
  const token = String(process.env.BACKUP_CLOUD_PUT_TOKEN || '').trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(url, { method: 'PUT', headers, body: bytes }, 45_000);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Upload do backup falhou (${res.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }
  return { uploaded: true };
}

export async function runBackup({ reason = 'manual', actor } = {}) {
  const skipped = skipBackup(reason);
  if (skipped) {
    return { skipped: true, reason: skipped };
  }

  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const filename = `bikeger-${stamp()}.json.gz`;
  const out = path.join(dir, filename);
  const payload = await buildBackupPayload();
  const bytes = await encodeBackupArchive(payload);
  await writeFile(out, bytes);

  let cloudUpload = false;
  let cloudError = '';
  if (cloudUploadConfigured()) {
    try {
      await uploadToCloud(filename, bytes);
      cloudUpload = true;
    } catch (error) {
      cloudError = error.message;
      logError(error, null, { job: 'backup.cloud', filename });
    }
  }

  await pruneOldBackups(dir);
  log('info', 'Backup Mongo gravado', {
    out,
    reason,
    source: payload.source,
    bytes: bytes.length,
    cloudUpload,
    retentionDays: RETENTION_DAYS,
  });
  await recordAudit({
    action: 'backup.created',
    actor,
    meta: { filename, reason, source: payload.source, bytes: bytes.length, cloudUpload, cloudError },
  });
  return {
    skipped: false,
    out,
    filename,
    reason,
    source: payload.source,
    bytes: bytes.length,
    cloudUpload,
    cloudError,
  };
}

export async function listBackups() {
  const dir = backupDir();
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const backups = [];
  for (const entry of entries) {
    if (!ARCHIVE_NAME_RE.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    try {
      const info = await stat(full);
      backups.push({
        name: entry.name,
        size: info.size,
        createdAt: info.mtime.toISOString(),
        kind: entry.isDirectory() ? 'dump-dir' : 'archive',
      });
    } catch {
      continue;
    }
  }
  backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    source: backupSourceLabel(),
    ephemeral: isProduction(),
    cloudUpload: cloudUploadConfigured(),
    retentionDays: RETENTION_DAYS,
    backups,
  };
}

export async function readBackupFile(name) {
  const { base, full } = safeBackupName(name);
  const info = await stat(full).catch(() => null);
  if (!info || !info.isFile()) throw httpError(404, 'Backup não encontrado');
  return { name: base, full, size: info.size, stream: createReadStream(full) };
}

export async function restoreFromPayload(payload, { actor } = {}) {
  const db = nativeDb();
  const collections = payload.collections || {};
  const restored = [];
  for (const [name, docs] of Object.entries(collections)) {
    if (SKIP_RESTORE.has(name) || !Array.isArray(docs)) continue;
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    restored.push({ name, count: docs.length });
  }
  log('info', 'Restore Mongo concluído', { source: payload.source, collections: restored.length });
  await recordAudit({
    action: 'backup.restored',
    actor,
    meta: { source: payload.source, collections: restored.map((item) => item.name) },
  });
  return { source: payload.source, collections: restored };
}

export async function restoreFromBuffer(buffer, { actor } = {}) {
  const payload = await decodeBackupArchive(buffer);
  return restoreFromPayload(payload, { actor });
}

export async function restoreNamedBackup(name, { actor } = {}) {
  const { full } = safeBackupName(name);
  const info = await stat(full).catch(() => null);
  if (!info) throw httpError(404, 'Backup não encontrado');
  if (info.isDirectory()) {
    await runCommand('mongorestore', [`--uri=${mongoUri()}`, '--drop', full]);
    log('info', 'Restore Mongo (dump) concluído', { dumpPath: full });
    await recordAudit({ action: 'backup.restored', actor, meta: { dumpPath: name, kind: 'dump-dir' } });
    return { dumpPath: name, kind: 'dump-dir' };
  }
  const buffer = await readFile(full);
  return restoreFromBuffer(buffer, { actor });
}

export async function runRestore(dumpPath, { actor } = {}) {
  if (!dumpPath) throw new Error('Informe o arquivo do backup (backend/backups/bikeger-....json.gz)');
  const resolved = path.resolve(dumpPath);
  const info = await stat(resolved).catch(() => null);
  if (!info) throw new Error(`Backup não encontrado: ${dumpPath}`);
  if (info.isDirectory()) {
    await runCommand('mongorestore', [`--uri=${mongoUri()}`, '--drop', resolved]);
    log('info', 'Restore Mongo concluído', { dumpPath: resolved });
    return { dumpPath: resolved, kind: 'dump-dir' };
  }
  return restoreFromBuffer(await readFile(resolved), { actor });
}
