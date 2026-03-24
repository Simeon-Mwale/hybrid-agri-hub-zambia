// src/app/api/farmer/alerts/[id]/read/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helper";

// The PriceAlert model has no "read" field, so we handle this
// as a UI-only operation — just confirm success so the dashboard
// can mark it read in local state. If you want persistence,
// add a `read Boolean @default(false)` field to PriceAlert in schema.prisma.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Alert id is available via params.id if you need to persist read state later
    // const alertId = params.id;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark alert read error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}