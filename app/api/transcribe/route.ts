// app/api/transcribe/route.ts
// Legacy endpoint — delegates to the direct execution or queue logic
import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/db/prisma';
import { addTranscriptionJob, isRedisConfigured } from '@/lib/queue/redis-queue';
import { executeDirectTranscription } from '@/lib/transcription/direct';
import { memoryStore } from '@/lib/transcription/store';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, language = 'auto' } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    let file: any = null;
    try {
      await ensureDbInitialized();
      file = await prisma.file.findUnique({
        where:   { id: fileId },
        include: { project: true },
      });
    } catch {}

    if (!file) {
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
      return NextResponse.json({ error: 'File not found. Please upload the file first.' }, { status: 404 });
    }

    const jobId = uuidv4();
    const projectId = file.projectId || 'default';

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

    try {
      await ensureDbInitialized();
      await prisma.transcriptionJob.create({
        data: { id: jobId, fileId: file.id, status: 'pending', language: language === 'auto' ? null : language },
      });
      await prisma.file.update({ where: { id: file.id }, data: { status: 'processing' } });
    } catch {}

    const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
    const shouldUseQueue = !isServerless && isRedisConfigured();

    if (shouldUseQueue) {
      try {
        await addTranscriptionJob({
          jobId,
          fileId:    file.id,
          filePath:  file.path,
          language,
          projectId,
          userId:    file.project?.userId || 'anonymous',
        });

        return NextResponse.json({
          success: true,
          jobId,
          status:  'pending',
          message: 'Transcription queued. Poll /api/status/' + jobId,
        });
      } catch (queueErr) {
        console.warn('[/api/transcribe] Queue unavailable, falling back to direct serverless transcription:', queueErr);
      }
    }

    const directResult = await executeDirectTranscription({
      jobId,
      fileId:   file.id,
      filePath: file.path,
      language,
      projectId,
    });

    return NextResponse.json({
      success: directResult.status === 'completed',
      jobId,
      status:  directResult.status,
      message: directResult.status === 'completed' ? 'Transcription completed' : directResult.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[/api/transcribe]', message);
    return NextResponse.json({ error: `Failed to start transcription: ${message}` }, { status: 500 });
  }
}