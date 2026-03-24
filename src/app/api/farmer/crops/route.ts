// src/app/api/farmer/crops/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const crops = await prisma.crop.findMany({
      select: { id: true, name: true, unit: true, category: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: crops });
  } catch (error) {
    console.error("Crops GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}