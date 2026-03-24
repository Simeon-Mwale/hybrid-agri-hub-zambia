// src/app/api/auth/[...nextauth]/route.ts
// NextAuth is no longer used — auth is handled via custom JWT (auth_token cookie).
// This file is kept as a stub so any legacy /api/auth/... calls don't 404.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "NextAuth is not configured. Use /api/auth/login instead." },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "NextAuth is not configured. Use /api/auth/login instead." },
    { status: 404 }
  );
}