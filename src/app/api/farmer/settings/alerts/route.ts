// src/app/api/farmer/settings/alerts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-helper";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const alerts = await prisma.priceAlert.findMany({
      where: { userId },
      include: {
        crop: { select: { name: true, unit: true } },
        market: { select: { name: true, province: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: alerts });
  } catch (error) {
    console.error("Alerts GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { cropId, marketId, targetPrice } = await request.json();
    if (!cropId || !marketId || targetPrice == null) {
      return NextResponse.json(
        { success: false, error: "cropId, marketId and targetPrice are required" },
        { status: 400 }
      );
    }

    const alert = await prisma.priceAlert.upsert({
      where: { userId_cropId_marketId: { userId, cropId, marketId } },
      update: { targetPrice, isActive: true },
      create: { userId, cropId, marketId, targetPrice },
      include: {
        crop: { select: { name: true, unit: true } },
        market: { select: { name: true, province: true } },
      },
    });

    return NextResponse.json({ success: true, data: alert, message: "Price alert saved" });
  } catch (error) {
    console.error("Alerts POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { alertId } = await request.json();
    if (!alertId) {
      return NextResponse.json({ success: false, error: "alertId is required" }, { status: 400 });
    }

    const existing = await prisma.priceAlert.findFirst({ where: { id: alertId, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 });
    }

    await prisma.priceAlert.delete({ where: { id: alertId } });

    return NextResponse.json({ success: true, message: "Alert removed" });
  } catch (error) {
    console.error("Alerts DELETE error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}