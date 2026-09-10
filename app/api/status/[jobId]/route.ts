// app/api/status/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/db/prisma';
import { getJobStatus } from '@/lib/queue/redis-queue';
import { memoryStore } from '@/lib/transcription/store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get from database
    let job: any = null;
    try {
      await ensureDbInitialized();
      job = await prisma.transcriptionJob.findUnique({
        where: { id: jobId },
        include: {
          file: true,
          subtitles: {
            orderBy: { index: 'asc' },
          },
        },
      });
    } catch {}

    if (!job) {
      const memJob = memoryStore.getJob(jobId);
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
          result:     memJob.result,
        });
      }
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Build response
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

    // Add SRT content if completed
    if (job.status === 'completed') {
      response.srtContent = job.srtContent;
      response.subtitles = job.subtitles?.map((s: any) => ({
        index: s.index,
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text,
      })) || [];
      response.result = job.result ? (typeof job.result === 'string' ? JSON.parse(job.result) : job.result) : null;
    }

    // Get queue progress (non-critical)
    try {
      const queueStatus = await getJobStatus(jobId);
      if (queueStatus) {
        response.queueState = queueStatus.state;
        response.queueProgress = queueStatus.progress;
      }
    } catch {}

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}