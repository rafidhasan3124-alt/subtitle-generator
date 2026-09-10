// lib/transcription/store.ts
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface StoredSubtitle {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface StoredJob {
  id: string;
  fileId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  language?: string;
  duration?: number;
  error?: string;
  result?: any;
  srtContent?: string;
  srtPath?: string;
  subtitles?: StoredSubtitle[];
  createdAt: string;
  updatedAt: string;
  file?: {
    id: string;
    name: string;
    size: number;
    type: string;
    path: string;
    projectId?: string;
  };
}

export interface StoredFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  duration?: number;
  path: string;
  projectId: string;
  status: string;
  createdAt: string;
}

// Global in-memory cache
const globalStore = globalThis as unknown as {
  __subtitle_jobs?: Map<string, StoredJob>;
  __subtitle_files?: Map<string, StoredFile>;
};

if (!globalStore.__subtitle_jobs) {
  globalStore.__subtitle_jobs = new Map();
}
if (!globalStore.__subtitle_files) {
  globalStore.__subtitle_files = new Map();
}

const jobsMap = globalStore.__subtitle_jobs;
const filesMap = globalStore.__subtitle_files;

// Helper to persist/read fallback to /tmp so multiple lambda invocations can share if /tmp persists
function getTmpStorePath(): string {
  return path.join(os.tmpdir(), 'subtitle_store.json');
}

function loadTmpStore(): { jobs: Record<string, StoredJob>; files: Record<string, StoredFile> } {
  try {
    const p = getTmpStorePath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return { jobs: data.jobs || {}, files: data.files || {} };
    }
  } catch {}
  return { jobs: {}, files: {} };
}

function saveTmpStore() {
  try {
    const p = getTmpStorePath();
    const jobsObj: Record<string, StoredJob> = {};
    const filesObj: Record<string, StoredFile> = {};
    jobsMap.forEach((v, k) => { jobsObj[k] = v; });
    filesMap.forEach((v, k) => { filesObj[k] = v; });
    fs.writeFileSync(p, JSON.stringify({ jobs: jobsObj, files: filesObj }), 'utf-8');
  } catch {}
}

export const memoryStore = {
  saveFile(file: StoredFile) {
    filesMap.set(file.id, file);
    saveTmpStore();
  },

  getFile(id: string): StoredFile | null {
    if (filesMap.has(id)) return filesMap.get(id)!;
    const disk = loadTmpStore();
    if (disk.files[id]) {
      filesMap.set(id, disk.files[id]);
      return disk.files[id];
    }
    return null;
  },

  saveJob(job: StoredJob) {
    jobsMap.set(job.id, job);
    saveTmpStore();
  },

  updateJob(id: string, updates: Partial<StoredJob>): StoredJob | null {
    const existing = this.getJob(id);
    if (!existing) return null;
    const updated: StoredJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    jobsMap.set(id, updated);
    saveTmpStore();
    return updated;
  },

  getJob(id: string): StoredJob | null {
    if (jobsMap.has(id)) return jobsMap.get(id)!;
    const disk = loadTmpStore();
    if (disk.jobs[id]) {
      jobsMap.set(id, disk.jobs[id]);
      return disk.jobs[id];
    }
    return null;
  },
};
