// app/api/status/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getJobStatus } from '@/lib/queue/redis-queue';

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
    const job = await prisma.transcriptionJob.findUnique({
      where: { id: jobId },
      include: {
        file: true,
        subtitles: {
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
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
        id: job.file.id,
        name: job.file.originalName,
        size: job.file.size,
        type: job.file.mimeType,
      },
    };

    // Add SRT content if completed
    if (job.status === 'completed') {
      response.srtContent = job.srtContent;
      response.subtitles = job.subtitles.map(s => ({
        index: s.index,
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text,
      }));
      response.result = job.result ? JSON.parse(job.result as string) : null;
    }

    // Get queue progress (non-critical; if Redis unavailable, just skip)
    const queueStatus = await getJobStatus(jobId);
    if (queueStatus) {
      response.queueState = queueStatus.state;
      response.queueProgress = queueStatus.progress;
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}