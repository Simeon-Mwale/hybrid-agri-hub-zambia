import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cropName   = searchParams.get("crop");
    const marketName = searchParams.get("market");
    const days       = parseInt(searchParams.get("days") ?? "30", 10);

    if (!cropName || !marketName) {
      return NextResponse.json({ success: false, error: "crop and market are required" }, { status: 400 });
    }

    const [crop, market] = await Promise.all([
      prisma.crop.findFirst({ where: { name: { equals: cropName } } }),
      prisma.market.findFirst({ where: { name: { equals: marketName } } }),
    ]);

    if (!crop || !market) {
      return NextResponse.json({ success: false, error: "Crop or market not found" }, { status: 404 });
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const prices = await prisma.dailyPrice.findMany({
      where: { cropId: crop.id, marketId: market.id, priceDate: { gte: fromDate } },
      orderBy: { priceDate: "asc" },
    });

    const predictions = await prisma.prediction.findMany({
      where: { cropId: crop.id, marketId: market.id },
      orderBy: { predictionDate: "asc" },
    });

    const historicalDates  = prices.map((p) => p.priceDate.toISOString().slice(0, 10));
    const predictionDates  = predictions.map((p) => p.predictionDate.toISOString().slice(0, 10));
    const allDates         = [...new Set([...historicalDates, ...predictionDates])].sort();

    const priceMap      = Object.fromEntries(prices.map((p) => [p.priceDate.toISOString().slice(0, 10), p.price]));
    const predictionMap = Object.fromEntries(predictions.map((p) => [p.predictionDate.toISOString().slice(0, 10), p.predictedPrice]));

    return NextResponse.json({
      success: true,
      data: {
        labels:      allDates,
        prices:      allDates.map((d) => priceMap[d]      ?? null),
        predictions: allDates.map((d) => predictionMap[d] ?? null),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/prices/trends error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch price trends" }, { status: 500 });
  }
}