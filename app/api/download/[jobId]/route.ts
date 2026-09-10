// app/api/download/[jobId]/route.ts
import { NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/db/prisma';
import { memoryStore } from '@/lib/transcription/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    let job: any = null;
    try {
      await ensureDbInitialized();
      job = await prisma.transcriptionJob.findUnique({
        where: { id: jobId },
        include: { file: true },
      });
    } catch {}

    if (!job) {
      const memJob = memoryStore.getJob(jobId);
      if (memJob) {
        job = {
          id:         memJob.id,
          status:     memJob.status,
          srtContent: memJob.srtContent,
          file:       memJob.file ? { originalName: memJob.file.name } : null,
        };
      }
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Transcription is not completed yet. Please wait.' },
        { status: 400 }
      );
    }

    if (!job.srtContent) {
      return NextResponse.json(
        { error: 'SRT content is not available for this job.' },
        { status: 404 }
      );
    }

    // Build a safe ASCII filename + RFC 5987 UTF-8 encoded version for Unicode support
    const originalName = job.file?.originalName || 'subtitles';
    const baseName     = originalName.replace(/\.[^.]+$/, '');
    const fileName     = `${baseName}-subtitles.srt`;
    const asciiName    = fileName.replace(/[^\x20-\x7E]/g, '_');
    const encodedName  = encodeURIComponent(fileName);

    return new NextResponse(job.srtContent, {
      headers: {
        'Content-Type': 'application/x-subrip; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        'Content-Length': Buffer.byteLength(job.srtContent, 'utf8').toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to download';
    console.error('[Download]', message);
    return NextResponse.json({ error: 'Download failed. Please try again.' }, { status: 500 });
  }
}