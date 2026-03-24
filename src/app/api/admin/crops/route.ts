import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

export async function GET() {
  try {
    const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data: crops });
  } catch (error) {
    console.error("GET /api/admin/crops error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch crops" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload();
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, category, unit } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const crop = await prisma.crop.create({ data: { name, category, unit: unit || "50kg bag" } });
    return NextResponse.json({ success: true, data: crop });
  } catch (error) {
    console.error("POST /api/admin/crops error:", error);
    return NextResponse.json({ success: false, error: "Failed to create crop" }, { status: 500 });
  }
}