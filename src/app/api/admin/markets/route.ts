import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

export async function GET() {
  try {
    const markets = await prisma.market.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data: markets });
  } catch (error) {
    console.error("GET /api/admin/markets error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch markets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload();
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, province, district } = await req.json();
    if (!name || !province) return NextResponse.json({ error: "Name and province are required" }, { status: 400 });
    const market = await prisma.market.create({ data: { name, province, district } });
    return NextResponse.json({ success: true, data: market });
  } catch (error) {
    console.error("POST /api/admin/markets error:", error);
    return NextResponse.json({ success: false, error: "Failed to create market" }, { status: 500 });
  }
}