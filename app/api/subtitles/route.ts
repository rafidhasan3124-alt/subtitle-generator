// app/api/subtitles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { addTranscriptionJob } from '@/lib/queue/redis-queue';
import { getProviderStatuses } from '@/lib/cloud-ai/factory';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileId,
      language    = 'auto',
      model       = 'small',
      prompt      = '',
      aiProvider  = process.env.AI_PROVIDER || 'huggingface',
    } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Validate provider token BEFORE touching the DB
    const statuses      = getProviderStatuses();
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
          message:      `${providerStatus.name} API key is not set. Add ${providerStatus.envKey} to your .env.local file.`,
        },
        { status: 402 }
      );
    }

    // Fetch file record
    const file = await prisma.file.findUnique({
      where:   { id: fileId },
      include: { project: true },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found. Please upload the file again.' },
        { status: 404 }
      );
    }

    // Guard: already processing — return existing job
    if (file.status === 'processing') {
      const existingJob = await prisma.transcriptionJob.findFirst({
        where:   { fileId: file.id, status: { in: ['pending', 'processing'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existingJob) {
        return NextResponse.json({
          subtitleId: existingJob.id,
          id:         existingJob.id,
          status:     existingJob.status,
          message:    'Already processing.',
        });
      }
    }

    // Guard: already completed — return cached result
    if (file.status === 'done') {
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
    }

    // Create DB job record
    const job = await prisma.transcriptionJob.create({
      data: {
        fileId:   file.id,
        status:   'pending',
        language: language === 'auto' ? null : language,
      },
    });

    // Mark file as processing
    await prisma.file.update({
      where: { id: file.id },
      data:  { status: 'processing' },
    });

    // ── Enqueue job with FILE PATH only (not the entire audio buffer) ──────────
    // This fixes the critical memory/Redis exhaustion bug.
    await addTranscriptionJob({
      jobId:      job.id,
      fileId:     file.id,
      filePath:   file.path,       // ← path only; worker reads the file itself
      language,
      model,
      prompt,
      aiProvider,
      projectId:  file.projectId,
      userId:     file.project.userId,
    });

    return NextResponse.json({
      subtitleId: job.id,
      id:         job.id,
      status:     'pending',
      message:    'Transcription queued.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[POST /api/subtitles]', message);

    // Return clean messages — never expose raw stack traces or Redis details
    if (message.includes('Queue service')) {
      return NextResponse.json(
        { error: 'The processing queue is not available. Please ensure the worker is running and try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to start subtitle generation. Please try again.' },
      { status: 500 }
    );
  }
}
