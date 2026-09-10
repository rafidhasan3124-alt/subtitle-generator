// lib/transcription/direct.ts
import fs from 'fs/promises';
import { prisma, ensureDbInitialized } from '../db/prisma';
import { createSTTProvider, getFallbackProvider } from '../cloud-ai/factory';
import type { AIProviderType } from '../cloud-ai/types';
import { SRTGenerator, SRTSubtitle } from '../srt/generator';
import { memoryStore } from './store';

export interface DirectTranscriptionParams {
  jobId: string;
  fileId: string;
  filePath: string;
  language?: string;
  model?: string;
  prompt?: string;
  aiProvider?: string;
  projectId?: string;
}

export interface DirectTranscriptionResult {
  jobId: string;
  status: 'completed' | 'failed';
  language?: string;
  duration?: number;
  srtContent?: string;
  subtitles?: Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }>;
  error?: string;
}

export async function executeDirectTranscription(
  params: DirectTranscriptionParams
): Promise<DirectTranscriptionResult> {
  const {
    jobId,
    fileId,
    filePath,
    language = 'auto',
    model = 'small',
    prompt = '',
    aiProvider = process.env.AI_PROVIDER || 'huggingface',
    projectId,
  } = params;

  console.log(`[DirectTranscription] Processing job ${jobId} | provider=${aiProvider} | model=${model} | lang=${language}`);

  // Mark job as processing
  memoryStore.updateJob(jobId, { status: 'processing' });
  try {
    await ensureDbInitialized();
    await prisma.transcriptionJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });
  } catch {}

  try {
    if (!filePath) {
      throw new Error('Missing filePath — cannot process audio.');
    }

    const buffer = await fs.readFile(filePath);
    const provider = createSTTProvider(aiProvider as AIProviderType);

    let result;
    try {
      result = await provider.transcribe(buffer, {
        language: language === 'auto' ? undefined : language,
        punctuation: true,
        formatText: true,
        prompt: prompt || undefined,
        ...(model && { model }),
      } as any);
    } catch (primaryErr: any) {
      console.error('[DirectTranscription] Primary provider failed:', primaryErr.message);
      const fallback = getFallbackProvider();
      if (fallback) {
        console.log('[DirectTranscription] Switching to fallback provider...');
        result = await fallback.transcribe(buffer, {
          language: language === 'auto' ? undefined : language,
          punctuation: true,
          formatText: true,
        });
      } else {
        throw primaryErr;
      }
    }

    if (!result || !result.segments || result.segments.length === 0) {
      throw new Error('No speech detected in the audio. Please check the file and try again.');
    }

    // Generate subtitles and SRT content
    const subtitles: SRTSubtitle[] = SRTGenerator.fromTranscript(result.segments);
    const srtContent = SRTGenerator.generate(subtitles);

    const formattedSubtitles = subtitles.map((s) => ({
      index: s.index,
      startTime: s.start,
      endTime: s.end,
      text: s.text,
    }));

    // Save to memoryStore first (guaranteed success)
    memoryStore.updateJob(jobId, {
      status: 'completed',
      language: result.language,
      duration: result.duration,
      result,
      srtContent,
      subtitles: formattedSubtitles,
    });

    // Persist to Prisma DB if available
    try {
      await ensureDbInitialized();
      await prisma.$transaction([
        prisma.transcriptionJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            language: result.language,
            duration: result.duration,
            result: JSON.stringify(result),
            srtContent,
          },
        }),
        prisma.file.update({
          where: { id: fileId },
          data: { status: 'done', duration: result.duration },
        }),
        prisma.subtitle.deleteMany({ where: { jobId } }),
        ...subtitles.map((sub) =>
          prisma.subtitle.create({
            data: {
              jobId,
              projectId: projectId || 'default',
              index: sub.index,
              startTime: sub.start,
              endTime: sub.end,
              text: sub.text,
            },
          })
        ),
      ]);
    } catch (dbErr) {
      console.warn('[DirectTranscription] DB save warning (memory fallback active):', dbErr);
    }

    console.log(`[DirectTranscription] Job ${jobId} completed successfully with ${subtitles.length} subtitles.`);

    return {
      jobId,
      status: 'completed',
      language: result.language,
      duration: result.duration,
      srtContent,
      subtitles: formattedSubtitles,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Transcription failed';
    console.error(`[DirectTranscription] Job ${jobId} failed:`, errorMsg);

    memoryStore.updateJob(jobId, {
      status: 'failed',
      error: errorMsg,
    });

    try {
      await ensureDbInitialized();
      await prisma.transcriptionJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: errorMsg },
      });
      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'failed' },
      });
    } catch {}

    return {
      jobId,
      status: 'failed',
      error: errorMsg,
    };
  }
}
