// app/api/transcribe/route.ts
// Legacy endpoint — kept for compatibility but delegates to the same queue logic.
// New code should use POST /api/subtitles instead.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { addTranscriptionJob } from '@/lib/queue/redis-queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, language = 'auto' } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const file = await prisma.file.findUnique({
      where:   { id: fileId },
      include: { project: true },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found. Please upload the file first.' }, { status: 404 });
    }

    if (file.status === 'processing') {
      return NextResponse.json({ error: 'This file is already being processed.' }, { status: 400 });
    }

    if (file.status === 'done') {
      const existingJob = await prisma.transcriptionJob.findFirst({
        where:   { fileId: file.id, status: 'completed' },
        orderBy: { createdAt: 'desc' },
      });
      if (existingJob) {
        return NextResponse.json({ success: true, jobId: existingJob.id, status: 'completed' });
      }
    }

    const job = await prisma.transcriptionJob.create({
      data: { fileId: file.id, status: 'pending', language: language === 'auto' ? null : language },
    });

    await prisma.file.update({ where: { id: file.id }, data: { status: 'processing' } });

    // Pass file PATH — not the buffer — to avoid Redis memory exhaustion
    await addTranscriptionJob({
      jobId:     job.id,
      fileId:    file.id,
      filePath:  file.path,      // ← path only
      language,
      projectId: file.projectId,
      userId:    file.project.userId,
    });

    return NextResponse.json({
      success: true,
      jobId:   job.id,
      status:  'pending',
      message: 'Transcription queued. Poll /api/status/' + job.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[/api/transcribe]', message);
    return NextResponse.json({ error: 'Failed to start transcription. Please try again.' }, { status: 500 });
  }
}