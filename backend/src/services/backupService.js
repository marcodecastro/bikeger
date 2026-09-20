import { spawn } from 'node:child_process';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { log, logError } from '../utils/logger.js';

const RETENTION_DAYS = 14;

export function backupDir() {
  return process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');
}

export function mongoUri() {
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bikeger';
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function skipBackup(reason) {
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_BACKUP === 'true') return 'test';
  if (reason === 'job' && process.env.NODE_ENV !== 'production' && process.env.BACKUP_ON_CLOSE !== 'true') {
    return 'dev';
  }
  return '';
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
    if (!entry.isDirectory() || !entry.name.startsWith('bikeger-')) continue;
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

export async function runBackup({ reason = 'manual' } = {}) {
  const skipped = skipBackup(reason);
  if (skipped) {
    return { skipped: true, reason: skipped };
  }

  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `bikeger-${stamp()}`);
  await mkdir(out, { recursive: true });

  try {
    await runCommand('mongodump', [`--uri=${mongoUri()}`, `--out=${out}`]);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log('warn', 'mongodump não está no PATH. Instale as Database Tools e rode npm run backup.', {
        reason,
      });
      await rm(out, { recursive: true, force: true }).catch(() => undefined);
      return { skipped: true, reason: 'mongodump-missing' };
    }
    logError(error, null, { job: 'backup.daily', reason });
    throw error;
  }

  await pruneOldBackups(dir);
  log('info', 'Backup Mongo gravado', { out, reason, retentionDays: RETENTION_DAYS });
  return { skipped: false, out, reason };
}

export async function runRestore(dumpPath) {
  if (!dumpPath) throw new Error('Informe a pasta do dump (backend/backups/bikeger-...)');
  await runCommand('mongorestore', [`--uri=${mongoUri()}`, '--drop', dumpPath]);
  log('info', 'Restore Mongo concluído', { dumpPath });
  return { dumpPath };
}
