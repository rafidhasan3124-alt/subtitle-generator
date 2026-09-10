// app/api/download/route.ts
// Root /api/download — returns 400 (jobId required)
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { error: 'Job ID is required. Use /api/download/[jobId]' },
    { status: 400 }
  );
}
