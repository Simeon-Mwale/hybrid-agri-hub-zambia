// src/app/api/farmer/markets/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const markets = await prisma.market.findMany({
      select: { id: true, name: true, province: true, district: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: markets });
  } catch (error) {
    console.error("Markets GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}