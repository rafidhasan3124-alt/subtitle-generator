// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';
import os from 'os';
import path from 'path';

// If in serverless (Netlify, Vercel, AWS Lambda) and DATABASE_URL is not an external DB, use /tmp/dev.db
const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
if (isServerless) {
  const currentUrl = process.env.DATABASE_URL;
  if (!currentUrl || currentUrl.startsWith('file:') || currentUrl.includes('.db')) {
    const tmpDb = path.join(os.tmpdir(), 'dev.db');
    process.env.DATABASE_URL = `file:${tmpDb}`;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __db_initialized?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

let dbInitPromise: Promise<void> | null = null;

/** Ensures SQLite tables exist when using /tmp/dev.db or newly created database */
export async function ensureDbInitialized(): Promise<void> {
  if (globalForPrisma.__db_initialized) return;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Project" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "File" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "filename" TEXT NOT NULL,
          "originalName" TEXT NOT NULL,
          "size" INTEGER NOT NULL,
          "mimeType" TEXT NOT NULL,
          "duration" REAL,
          "path" TEXT NOT NULL,
          "projectId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'uploaded',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TranscriptionJob" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "fileId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "error" TEXT,
          "language" TEXT,
          "duration" REAL,
          "result" TEXT,
          "srtContent" TEXT,
          "srtPath" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TranscriptionJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Subtitle" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "jobId" TEXT NOT NULL,
          "projectId" TEXT NOT NULL,
          "index" INTEGER NOT NULL,
          "startTime" REAL NOT NULL,
          "endTime" REAL NOT NULL,
          "text" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Subtitle_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TranscriptionJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Subtitle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      globalForPrisma.__db_initialized = true;
    } catch (e) {
      console.warn('[DB] Schema init note (tables may already exist or external DB):', e);
    }
  })();

  return dbInitPromise;
}