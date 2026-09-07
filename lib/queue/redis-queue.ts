// lib/queue/redis-queue.ts
import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// ─── Lazy singleton helpers ──────────────────────────────────────────────────
let _redis: Redis | null = null;
let _queue: Queue | null = null;
let _queueEvents: QueueEvents | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    _redis.on('error', (err) => {
      // Log internally but never expose connection details to clients
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return _redis;
}

export function getTranscriptionQueue(): Queue {
  if (!_queue) {
    _queue = new Queue('transcription', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 24 * 3600, count: 1000 },
      },
    });
  }
  return _queue;
}

export function getQueueEvents(): QueueEvents {
  if (!_queueEvents) {
    _queueEvents = new QueueEvents('transcription', { connection: getRedis() });
  }
  return _queueEvents;
}

export { getRedis as redis };

export interface TranscriptionJobData {
  jobId: string;
  fileId: string;
  /** Absolute filesystem path to the audio file — worker reads it directly (no base64 bloat) */
  filePath: string;
  language?: string;
  model?: string;
  prompt?: string;
  aiProvider?: string;
  projectId: string;
  userId: string;
}

export async function addTranscriptionJob(data: TranscriptionJobData) {
  try {
    const queue = getTranscriptionQueue();
    return await queue.add('transcribe', data, { jobId: data.jobId });
  } catch (err: unknown) {
    // Wrap Redis/BullMQ errors so the caller gets a clean message
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      throw new Error('Queue service is unavailable. Please ensure Redis is running and try again.');
    }
    throw err;
  }
}

export async function getJobStatus(jobId: string) {
  try {
    const queue = getTranscriptionQueue();
    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state    = await job.getState();
    const progress = job.progress;

    return {
      id:           job.id,
      state,
      progress,
      data:         job.data,
      returnvalue:  job.returnvalue,
      failedReason: job.failedReason,
      timestamp:    job.timestamp,
      processedOn:  job.processedOn,
      finishedOn:   job.finishedOn,
    };
  } catch {
    return null;
  }
}