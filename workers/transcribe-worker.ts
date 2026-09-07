// workers/transcribe-worker.ts
import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createSTTProvider, getFallbackProvider } from '../lib/cloud-ai/factory';
import type { AIProviderType } from '../lib/cloud-ai/types';
import { SRTGenerator } from '../lib/srt/generator';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ workers
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('[Worker Redis] Connection error:', err.message);
});

const worker = new Worker(
  'transcription',
  async (job) => {
    const {
      jobId,
      fileId,
      filePath,                                          // ← file path, not base64 buffer
      language,
      model      = 'small',
      prompt     = '',
      aiProvider = process.env.AI_PROVIDER || 'huggingface',
      projectId,
    } = job.data;

    console.log(`[Worker] Job ${jobId} | provider=${aiProvider} | model=${model} | lang=${language}`);

    try {
      await prisma.transcriptionJob.update({
        where: { id: jobId },
        data:  { status: 'processing' },
      });

      await job.updateProgress(10);

      // ── Read audio file from disk (avoids Redis memory exhaustion) ────────────
      if (!filePath) throw new Error('Job is missing filePath — cannot process audio.');
      const buffer = await fs.readFile(filePath);

      await job.updateProgress(20);

      const provider = createSTTProvider(aiProvider as AIProviderType);

      let result;
      try {
        result = await provider.transcribe(buffer, {
          language:   language === 'auto' ? undefined : language,
          punctuation: true,
          formatText:  true,
          prompt:      prompt || undefined,
          ...(model && { model }),
        } as any);
      } catch (primaryErr: any) {
        console.error('[Worker] Primary provider failed:', primaryErr.message);
        const fallback = getFallbackProvider();
        if (fallback) {
          console.log('[Worker] Switching to fallback provider...');
          result = await fallback.transcribe(buffer, {
            language: language === 'auto' ? undefined : language,
            punctuation: true,
            formatText:  true,
          });
        } else {
          throw primaryErr;
        }
      }

      await job.updateProgress(80);

      if (!result || !result.segments || result.segments.length === 0) {
        throw new Error('No speech detected in the audio. Please check the file and try again.');
      }

      // Generate SRT
      const subtitles  = SRTGenerator.fromTranscript(result.segments);
      const srtContent = SRTGenerator.generate(subtitles);

      // Save SRT file — store relative path to avoid absolute-path breakage on redeploy
      const srtDir      = path.join(process.cwd(), 'public', 'subtitles');
      await fs.mkdir(srtDir, { recursive: true });
      const srtRelPath  = path.join('public', 'subtitles', `${jobId}.srt`);
      const srtAbsPath  = path.join(process.cwd(), srtRelPath);
      await fs.writeFile(srtAbsPath, srtContent, 'utf-8');

      await job.updateProgress(90);

      // Persist all results atomically
      await prisma.$transaction([
        prisma.transcriptionJob.update({
          where: { id: jobId },
          data: {
            status:     'completed',
            language:   result.language,
            duration:   result.duration,
            result:     JSON.stringify(result),
            srtContent,
            srtPath:    srtRelPath,   // ← relative path (Bug 21 fix)
          },
        }),
        prisma.file.update({
          where: { id: fileId },
          data:  { status: 'done', duration: result.duration },
        }),
        // Delete existing subtitles for idempotency on retry (Bug 42 fix)
        prisma.subtitle.deleteMany({ where: { jobId } }),
        ...subtitles.map((sub) =>
          prisma.subtitle.create({
            data: {
              jobId,
              projectId,
              index:     sub.index,
              startTime: sub.start,
              endTime:   sub.end,
              text:      sub.text,
            },
          })
        ),
      ]);

      await job.updateProgress(100);
      console.log(`[Worker] Job ${jobId} completed — ${subtitles.length} subtitles`);

      return {
        jobId,
        fileId,
        language: result.language,
        segments: subtitles.length,
        duration: result.duration,
        srtPath:  srtRelPath,
      };
    } catch (error: any) {
      console.error(`[Worker] Job ${jobId} failed:`, error.message);

      await prisma.transcriptionJob.update({
        where: { id: jobId },
        data:  { status: 'failed', error: error.message },
      }).catch(() => {});

      await prisma.file.update({
        where: { id: fileId },
        data:  { status: 'failed' },
      }).catch(() => {});

      throw error;
    }
  },
  {
    connection:  redis,
    concurrency: 3,
    limiter:     { max: 10, duration: 1000 },
  }
);

worker.on('completed', (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on('failed',    (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));
worker.on('error',     (err) => console.error('[Worker] Uncaught error:', err));

async function shutdown() {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

console.log('[Worker] Transcription worker started and waiting for jobs...');