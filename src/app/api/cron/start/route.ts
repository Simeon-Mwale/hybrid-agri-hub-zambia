// src/app/api/cron/start/route.ts
import { NextResponse } from 'next/server';

// This will start the cron jobs when the API is called
export async function GET() {
  // Only start in production or if explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    // Dynamically import to avoid issues during build
    import('@/lib/cron/scheduler').catch(console.error);
    return NextResponse.json({ message: 'Cron jobs started' });
  }
  
  return NextResponse.json({ message: 'Cron jobs disabled' });
}