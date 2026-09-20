import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { log, logError } from './logger.js';

const handlers = new Map();
let running = false;
let handlersReady = false;

export function registerJob(name, handler) {
  handlers.set(name, handler);
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

async function ensureHandlers() {
  if (handlersReady) return;
  handlersReady = true;
  await import('../jobs/handlers.js');
}

export async function enqueueJob(name, payload = {}, { runAfter, maxAttempts } = {}) {
  if (typeof payload === 'function') {
    throw new Error(`enqueueJob('${name}') agora recebe payload persistido, não uma função`);
  }
  if (!mongoReady()) {
    log('warn', 'Job ignorado sem Mongo', { job: name });
    return null;
  }
  const job = await Job.create({
    name,
    payload: payload || {},
    status: 'pending',
    runAfter: runAfter || new Date(),
    maxAttempts: maxAttempts || 8,
  });
  pump();
  return job;
}

export function pump() {
  if (running || !mongoReady()) return;
  running = true;
  void runLoop().finally(() => {
    running = false;
  });
}

async function runLoop() {
  await ensureHandlers();
  for (;;) {
    if (!mongoReady()) return;
    const job = await claimNextJob();
    if (!job) return;
    const handler = handlers.get(job.name);
    try {
      if (!handler) throw new Error(`Job sem handler: ${job.name}`);
      await handler(job.payload || {}, job);
      if (!mongoReady()) return;
      job.status = 'done';
      job.lastError = '';
      await job.save();
    } catch (error) {
      if (!mongoReady()) return;
      job.attempts += 1;
      job.lastError = error.message || String(error);
      job.lockedAt = null;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        logError(error, null, { job: job.name, attempts: job.attempts });
      } else {
        job.status = 'pending';
        job.runAfter = new Date(Date.now() + backoffMs(job.attempts));
        log('warn', 'Job vai tentar de novo', {
          job: job.name,
          attempts: job.attempts,
          runAfter: job.runAfter,
          message: job.lastError,
        });
      }
      await job.save();
    }
  }
}

async function claimNextJob() {
  if (!mongoReady()) return null;
  const now = new Date();
  return Job.findOneAndUpdate(
    { status: 'pending', runAfter: { $lte: now } },
    { $set: { status: 'running', lockedAt: now } },
    { sort: { runAfter: 1, createdAt: 1 }, new: true },
  );
}

function backoffMs(attempts) {
  return Math.min(15 * 60 * 1000, 5000 * 2 ** Math.max(0, attempts - 1));
}

export async function recoverJobs() {
  if (!mongoReady()) return;
  const stale = new Date(Date.now() - 2 * 60 * 1000);
  await Job.updateMany(
    { status: 'running', $or: [{ lockedAt: { $lt: stale } }, { lockedAt: null }] },
    { $set: { status: 'pending', runAfter: new Date(), lockedAt: null } },
  );
}

export async function flushJobs() {
  if (!mongoReady()) return;
  await ensureHandlers();
  for (let i = 0; i < 80; i += 1) {
    if (!mongoReady()) return;
    pump();
    const pending = await Job.exists({
      status: { $in: ['pending', 'running'] },
      runAfter: { $lte: new Date() },
    });
    if (!pending && !running) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export function startJobWorker() {
  void recoverJobs().then(async () => {
    await ensureRecurringJob('os.parts-stale');
    pump();
  });
  setInterval(() => {
    void recoverJobs();
    pump();
  }, 15_000).unref?.();
}

export async function ensureRecurringJob(name) {
  if (!mongoReady()) return;
  const exists = await Job.exists({ name, status: { $in: ['pending', 'running'] } });
  if (exists) return;
  await enqueueJob(name, {});
}
