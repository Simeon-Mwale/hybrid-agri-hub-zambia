import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "10", 10);

    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }

    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: true },
    });

    const data = activities.map((a) => ({
      id:          a.id,
      type:        a.type.toLowerCase(), // ✅ normalize to match dashboard icons
      description: a.description,
      status:      a.status,
      metadata:    a.metadata ? JSON.parse(a.metadata) : null,
      user:        a.user ? a.user.fullName : "Unknown",
      createdAt:   a.createdAt.toISOString(),
      timestamp:   a.createdAt.toISOString(), // ✅ dashboard reads "timestamp"
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/activities error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}