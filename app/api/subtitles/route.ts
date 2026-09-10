// app/api/subtitles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/db/prisma';
import { addTranscriptionJob, isRedisConfigured } from '@/lib/queue/redis-queue';
import { getProviderStatuses } from '@/lib/cloud-ai/factory';
import { executeDirectTranscription } from '@/lib/transcription/direct';
import { memoryStore } from '@/lib/transcription/store';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileId,
      language   = 'auto',
      model      = 'small',
      prompt     = '',
      aiProvider = process.env.AI_PROVIDER || 'huggingface',
    } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Validate provider token BEFORE processing
    const statuses       = getProviderStatuses();
    const providerStatus = statuses.find((s) => s.id === aiProvider);

    if (!providerStatus) {
      return NextResponse.json(
        { error: `Unknown AI provider: "${aiProvider}"` },
        { status: 400 }
      );
    }

    if (!providerStatus.configured) {
      return NextResponse.json(
        {
          error:        'TOKEN_NOT_CONFIGURED',
          provider:     aiProvider,
          providerName: providerStatus.name,
          envKey:       providerStatus.envKey,
          signupUrl:    providerStatus.signupUrl,
          message:      `${providerStatus.name} API key is not set. Add ${providerStatus.envKey} to your Netlify Environment Variables (or .env.local for local development).`,
        },
        { status: 402 }
      );
    }

    // Fetch file record from DB or memory store
    let file: any = null;
    try {
      await ensureDbInitialized();
      file = await prisma.file.findUnique({
        where:   { id: fileId },
        include: { project: true },
      });
    } catch {}

    if (!file) {
      // Check memory store
      const memFile = memoryStore.getFile(fileId);
      if (memFile) {
        file = {
          id:        memFile.id,
          path:      memFile.path,
          name:      memFile.originalName,
          status:    memFile.status,
          projectId: memFile.projectId,
          project:   { userId: 'anonymous' },
        };
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: 'File not found. Please upload the file again.' },
        { status: 404 }
      );
    }

    // Check for existing completed job
    try {
      await ensureDbInitialized();
      const existingJob = await prisma.transcriptionJob.findFirst({
        where:   { fileId: file.id, status: 'completed' },
        include: { subtitles: { orderBy: { index: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      if (existingJob) {
        return NextResponse.json({
          subtitleId: existingJob.id,
          id:         existingJob.id,
          status:     'completed',
          language:   existingJob.language,
          duration:   existingJob.duration,
          srtContent: existingJob.srtContent,
          subtitles:  existingJob.subtitles.map((s) => ({
            index:     s.index,
            startTime: s.startTime,
            endTime:   s.endTime,
            text:      s.text,
          })),
        });
      }
    } catch {}

    const jobId = uuidv4();
    const projectId = file.projectId || 'default';

    // Store in memory store
    memoryStore.saveJob({
      id:        jobId,
      fileId:    file.id,
      status:    'pending',
      language:  language === 'auto' ? undefined : language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      file: {
        id:        file.id,
        name:      file.name || 'audio',
        size:      file.size || 0,
        type:      file.mimeType || 'audio/mpeg',
        path:      file.path,
        projectId,
      },
    });

    // Create DB job record if available
    try {
      await ensureDbInitialized();
      await prisma.transcriptionJob.create({
        data: {
          id:       jobId,
          fileId:   file.id,
          status:   'pending',
          language: language === 'auto' ? null : language,
        },
      });
      await prisma.file.update({
        where: { id: file.id },
        data:  { status: 'processing' },
      });
    } catch {}

    const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
    const shouldUseQueue = !isServerless && isRedisConfigured();

    if (shouldUseQueue) {
      try {
        await addTranscriptionJob({
          jobId,
          fileId:     file.id,
          filePath:   file.path,
          language,
          model,
          prompt,
          aiProvider,
          projectId,
          userId:     file.project?.userId || 'anonymous',
        });

        return NextResponse.json({
          subtitleId: jobId,
          id:         jobId,
          status:     'pending',
          message:    'Transcription queued.',
        });
      } catch (queueErr) {
        console.warn('[POST /api/subtitles] Queue failed, falling back to direct serverless transcription:', queueErr);
      }
    }

    // Direct serverless transcription (Works 100% on Netlify without Redis or workers)
    const directResult = await executeDirectTranscription({
      jobId,
      fileId:   file.id,
      filePath: file.path,
      language,
      model,
      prompt,
      aiProvider,
      projectId,
    });

    if (directResult.status === 'completed') {
      return NextResponse.json({
        subtitleId: jobId,
        id:         jobId,
        status:     'completed',
        language:   directResult.language,
        duration:   directResult.duration,
        srtContent: directResult.srtContent,
        subtitles:  directResult.subtitles,
        message:    'Transcription completed successfully.',
      });
    } else {
      return NextResponse.json(
        {
          subtitleId: jobId,
          id:         jobId,
          status:     'failed',
          error:      directResult.error || 'Transcription failed. Please check your file or AI token.',
        },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[POST /api/subtitles]', message);

    return NextResponse.json(
      { error: `Failed to start subtitle generation: ${message}` },
      { status: 500 }
    );
  }
}
