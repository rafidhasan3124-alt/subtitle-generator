// app/api/providers/route.ts
import { NextResponse } from 'next/server';
import { getProviderStatuses } from '@/lib/cloud-ai/factory';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const statuses = getProviderStatuses();
    return NextResponse.json({ providers: statuses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
