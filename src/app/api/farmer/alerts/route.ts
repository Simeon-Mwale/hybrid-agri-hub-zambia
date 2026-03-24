import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-helper";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const alerts = await prisma.priceAlert.findMany({
      where: { userId, isActive: true },
      include: {
        crop: { select: { id: true, name: true, unit: true } },
        market: { select: { id: true, name: true, district: true, province: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Shape into the Alert interface with full details
    const shaped = alerts.map((a) => ({
      id: a.id,
      cropId: a.crop.id,
      cropName: a.crop.name,
      marketId: a.market.id,
      marketName: a.market.name,
      targetPrice: a.targetPrice,
      type: "info" as const,
      title: `${a.crop.name} price alert`,
      message: `You will be notified when ${a.crop.name} at ${a.market.name} reaches ZMW ${a.targetPrice.toFixed(2)}.`,
      date: a.createdAt.toISOString(),
      read: false,
      actionable: false,
    }));

    return NextResponse.json({ success: true, data: shaped });
  } catch (error) {
    console.error("Farmer alerts GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Farmer alerts POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}