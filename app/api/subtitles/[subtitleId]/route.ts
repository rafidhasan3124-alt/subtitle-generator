// app/api/subtitles/[subtitleId]/route.ts
// GET /api/subtitles/[subtitleId] — polling endpoint called by the dashboard
import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/db/prisma';
import { getJobStatus } from '@/lib/queue/redis-queue';
import { memoryStore } from '@/lib/transcription/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { subtitleId: string } }
) {
  try {
    const { subtitleId } = params;

    if (!subtitleId) {
      return NextResponse.json({ error: 'Subtitle ID is required' }, { status: 400 });
    }

    // First try Prisma DB
    let job: any = null;
    try {
      await ensureDbInitialized();
      job = await prisma.transcriptionJob.findUnique({
        where: { id: subtitleId },
        include: {
          file: true,
          subtitles: { orderBy: { index: 'asc' } },
        },
      });
    } catch {}

    // Fall back to memory store if not found in DB
    if (!job) {
      const memJob = memoryStore.getJob(subtitleId);
      if (memJob) {
        return NextResponse.json({
          id:         memJob.id,
          status:     memJob.status,
          language:   memJob.language,
          duration:   memJob.duration,
          error:      memJob.error,
          createdAt:  memJob.createdAt,
          updatedAt:  memJob.updatedAt,
          file:       memJob.file,
          srtContent: memJob.srtContent,
          subtitles:  memJob.subtitles || [],
        });
      }
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Build response from DB record
    const response: Record<string, unknown> = {
      id: job.id,
      status: job.status,
      language: job.language,
      duration: job.duration,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      file: {
        id: job.file?.id,
        name: job.file?.originalName,
        size: job.file?.size,
        type: job.file?.mimeType,
      },
    };

    if (job.status === 'completed') {
      response.srtContent = job.srtContent;
      response.subtitles = job.subtitles?.map((s: any) => ({
        index: s.index,
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text,
      })) || [];
    }

    // Attach queue progress if available
    try {
      const queueStatus = await getJobStatus(subtitleId);
      if (queueStatus) {
        response.queueState = queueStatus.state;
        response.queueProgress = queueStatus.progress;
      }
    } catch {}

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[GET /api/subtitles/:id] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subtitle status.' },
      { status: 500 }
    );
  }
}
