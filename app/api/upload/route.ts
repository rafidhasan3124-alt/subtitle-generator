// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/db/prisma';
import { memoryStore } from '@/lib/transcription/store';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

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

async function getSafeUploadDir(): Promise<string> {
  const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
  const primaryDir = isServerless ? path.join(os.tmpdir(), 'uploads') : path.join(process.cwd(), 'uploads');
  
  try {
    await fs.mkdir(primaryDir, { recursive: true });
    return primaryDir;
  } catch (err) {
    // If process.cwd() failed (e.g. read-only filesystem), fallback to os.tmpdir()
    const tmpDir = path.join(os.tmpdir(), 'uploads');
    await fs.mkdir(tmpDir, { recursive: true });
    return tmpDir;
  }
}

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

    // File size check (max 500MB, default)
    const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000', 10);
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${(MAX_SIZE / 1024 / 1024).toFixed(0)} MB.` },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();

    // Extension must be in the allowed list
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext}". Accepted: MP3, WAV, M4A, MP4, MOV, MKV, WebM, OGG` },
        { status: 400 }
      );
    }

    // MIME type check (secondary)
    // Some browsers/files report a generic type like application/octet-stream or a
    // non-standard MIME even when the file extension is valid. We still accept the
    // upload and normalize the MIME type from the extension instead of rejecting it.
    const declaredMimeType = file.type || '';
    const mimeType = ALLOWED_TYPES.has(declaredMimeType)
      ? declaredMimeType
      : (MIME_BY_EXT[ext] || 'application/octet-stream');

    if (declaredMimeType && !ALLOWED_TYPES.has(declaredMimeType) && declaredMimeType !== 'application/octet-stream') {
      console.warn(
        `[Upload] Non-standard MIME type for ${file.name}: "${declaredMimeType}". Falling back to extension-based MIME "${mimeType}".`
      );
    }

    const safeExt      = ALLOWED_EXTS.has(ext) ? ext : '.mp3';
    const fileId       = uuidv4();
    const safeFileName = `${fileId}${safeExt}`;
    const uploadDir    = await getSafeUploadDir();

    filePath = path.join(uploadDir, safeFileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    let projectId = 'default';

    // Store in memory fallback store
    memoryStore.saveFile({
      id:           fileId,
      filename:     safeFileName,
      originalName: file.name,
      size:         file.size,
      mimeType,
      path:         filePath,
      projectId,
      status:       'uploaded',
      createdAt:    new Date().toISOString(),
    });

    // Try persisting to Prisma DB
    try {
      await ensureDbInitialized();
      let project = await prisma.project.findFirst({
        where: { userId, name: 'Default Project' },
      });

      if (!project) {
        project = await prisma.project.create({
          data: { name: 'Default Project', userId },
        });
      }
      projectId = project.id;

      await prisma.file.create({
        data: {
          id:           fileId,
          filename:     safeFileName,
          originalName: file.name,
          size:         file.size,
          mimeType,
          path:         filePath,
          projectId,
          status:       'uploaded',
        },
      });
    } catch (dbErr) {
      console.warn('[Upload] DB write warning (falling back to serverless in-memory store):', dbErr);
    }

    return NextResponse.json({
      success: true,
      file: {
        id:        fileId,
        name:      file.name,
        size:      file.size,
        type:      mimeType,
        projectId,
        status:    'uploaded',
      },
    });
  } catch (err: unknown) {
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[Upload]', message);
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}