// src/app/api/admin/sms-queue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Admin guard ───────────────────────────────────────────────────────────────
async function requireAdmin() {
  const payload = await getAuthPayload();
  if (!payload)                 return { error: "Not authenticated", status: 401 } as const;
  if (payload.role !== "ADMIN") return { error: "Not authorized",    status: 403 } as const;
  return { payload };
}

// ── GET: Fetch SMS Queue + Stats ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit  = parseInt(searchParams.get("limit") || "50");

    const [pending, sent, failed] = await prisma.$transaction([
      prisma.smsQueue.count({ where: { status: "pending" } }),
      prisma.smsQueue.count({ where: { status: "sent"    } }),
      prisma.smsQueue.count({ where: { status: "failed"  } }),
    ]);

    const where      = status ? { status } : {};
    const queueItems = await prisma.smsQueue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const activeAlerts = await prisma.priceAlert.count({ where: { isActive: true } });

    return NextResponse.json({
      success: true,
      stats: { pending, sent, failed, total: pending + sent + failed, activeAlerts },
      queue: queueItems,
    });
  } catch (error) {
    console.error("SMS Queue GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}

// ── POST: Admin Actions ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body   = await request.json();
    const action = body?.action;

    if (!action) {
      return NextResponse.json({ success: false, error: "Action is required" }, { status: 400 });
    }

    switch (action) {
      case "process-sms": {
        const { processSmsQueue } = await import("@/lib/sms-queue");
        const result = await processSmsQueue();
        return NextResponse.json({ success: true, message: "SMS queue processed", ...result });
      }

      case "check-alerts": {
        const { PriceAlertChecker } = await import("@/lib/alerts/priceChecker");
        await PriceAlertChecker.checkAlerts();
        return NextResponse.json({ success: true, message: "Price alerts checked successfully" });
      }

      case "generate-predictions": {
        const { PricePredictor } = await import("@/lib/predictions/pricePredictor");
        await PricePredictor.generatePredictions();
        return NextResponse.json({ success: true, message: "Predictions generated successfully" });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("SMS Queue POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process action" },
      { status: 500 }
    );
  }
}