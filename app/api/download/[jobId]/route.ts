// app/api/download/[jobId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await prisma.transcriptionJob.findUnique({
      where: { id: jobId },
      include: { file: true },
    });

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
    const baseName   = originalName.replace(/\.[^.]+$/, '');
    const fileName   = `${baseName}-subtitles.srt`;
    // ASCII-safe fallback (replace non-ASCII with underscores)
    const asciiName  = fileName.replace(/[^\x20-\x7E]/g, '_');
    // RFC 5987 UTF-8 encoded filename for browsers that support it (fixes Bengali names)
    const encodedName = encodeURIComponent(fileName);

    return new NextResponse(job.srtContent, {
      headers: {
        // Correct MIME type for SRT files
        'Content-Type': 'application/x-subrip; charset=utf-8',
        // Dual filename: ASCII fallback + UTF-8 encoded for modern browsers (RFC 6266)
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