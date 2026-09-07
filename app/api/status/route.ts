// app/api/status/route.ts
// Root /api/status — returns server health
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'subtitle-generator' });
}
