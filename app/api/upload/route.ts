// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Correct MIME types by extension — fixes "video/mp3", "video/wav" etc.
const MIME_BY_EXT: Record<string, string> = {
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.m4a':  'audio/x-m4a',
  '.ogg':  'audio/ogg',
  '.mp4':  'video/mp4',
  '.mov':  'video/quicktime',
  '.webm': 'video/webm',
  '.mkv':  'video/x-matroska',
};

const ALLOWED_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/m4a', 'audio/mp4', 'audio/x-m4a',
  'audio/ogg', 'audio/webm',
  'video/mp4', 'video/quicktime', 'video/webm',
  'video/ogg', 'video/x-matroska', 'video/mkv',
]);

const ALLOWED_EXTS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.webm', '.ogg', '.mkv']);

export async function POST(req: NextRequest) {
  let filePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    // Sanitise userId — max 64 chars, alphanumeric + dash/underscore only
    const rawUserId = (formData.get('userId') as string) || 'anonymous';
    const userId    = rawUserId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || 'anonymous';

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided. Please select a file.' }, { status: 400 });
    }

    // File size — max 500 MB
    const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000', 10);
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${(MAX_SIZE / 1024 / 1024).toFixed(0)} MB.` },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();

    // Extension must be in the allowed list (authoritative server-side check)
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext}". Accepted: MP3, WAV, M4A, MP4, MOV, MKV, WebM, OGG` },
        { status: 400 }
      );
    }

    // MIME type check (secondary — browsers often send wrong MIME for audio files)
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unexpected content type "${file.type}" for extension "${ext}". Please try again.` },
        { status: 400 }
      );
    }

    const safeExt      = ALLOWED_EXTS.has(ext) ? ext : '.mp3';
    const safeFileName = `${uuidv4()}${safeExt}`;
    const uploadDir    = path.join(process.cwd(), 'uploads');

    await fs.mkdir(uploadDir, { recursive: true });

    filePath = path.join(uploadDir, safeFileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // DB — find or create default project for this user
    let project = await prisma.project.findFirst({
      where: { userId, name: 'Default Project' },
    });

    if (!project) {
      project = await prisma.project.create({
        data: { name: 'Default Project', userId },
      });
    }

    // Correct MIME type: prefer the browser-provided type, fall back to extension map
    const mimeType = ALLOWED_TYPES.has(file.type)
      ? file.type
      : (MIME_BY_EXT[safeExt] || 'application/octet-stream');

    const fileRecord = await prisma.file.create({
      data: {
        filename:     safeFileName,
        originalName: file.name,
        size:         file.size,
        mimeType,
        path:         filePath,
        projectId:    project.id,
        status:       'uploaded',
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id:        fileRecord.id,
        name:      fileRecord.originalName,
        size:      fileRecord.size,
        type:      fileRecord.mimeType,
        projectId: fileRecord.projectId,
        status:    fileRecord.status,
      },
    });
  } catch (err: unknown) {
    // Clean up the file if DB write failed (prevents orphaned files)
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[Upload]', message);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}