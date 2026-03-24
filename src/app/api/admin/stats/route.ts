import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalCrops, totalMarkets, pendingSMS, activeAlerts, todayPrices] =
      await Promise.all([
        prisma.user.count(),
        prisma.crop.count(),
        prisma.market.count(),
        prisma.smsQueue.count({ where: { status: "pending" } }), // ✅ lowercase
        prisma.priceAlert.count({ where: { isActive: true } }),
        prisma.dailyPrice.count({ where: { priceDate: { gte: today } } }),
      ]);

    return NextResponse.json({
      success: true,
      data: { totalUsers, totalCrops, totalMarkets, pendingSMS, activeAlerts, todayPrices },
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch stats" }, { status: 500 });
  }
}