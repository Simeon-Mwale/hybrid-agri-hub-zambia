// src/app/api/farmer/insights/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // ── 1. Fetch all crops and markets ────────────────────────────────────
    const [crops, markets] = await Promise.all([
      prisma.crop.findMany(),
      prisma.market.findMany(),
    ]);

    const insights = await Promise.all(
      crops.map(async (crop) => {
        // ── 2. Get last 30 days of prices across all markets for this crop ──
        const recentPrices = await prisma.dailyPrice.findMany({
          where: { cropId: crop.id },
          orderBy: { priceDate: "desc" },
          take: 30,
          include: { market: true },
        });

        if (recentPrices.length === 0) return null;

        // ── 3. Get all upcoming predictions for this crop ─────────────────
        const predictions = await prisma.prediction.findMany({
          where: { cropId: crop.id },
          orderBy: { predictionDate: "asc" },
          take: 10,
          include: { market: true },
        });

        // ── 4. Compute metrics ────────────────────────────────────────────

        // Current average price (latest day across markets)
        const latestDate = recentPrices[0].priceDate;
        const latestPrices = recentPrices.filter(
          (p) => p.priceDate.toDateString() === latestDate.toDateString()
        );
        const avgCurrentPrice =
          latestPrices.reduce((sum, p) => sum + p.price, 0) / latestPrices.length;

        // Previous week average for trend direction
        const weekAgoCutoff = new Date(latestDate);
        weekAgoCutoff.setDate(weekAgoCutoff.getDate() - 7);
        const olderPrices = recentPrices.filter(
          (p) => p.priceDate <= weekAgoCutoff
        );
        const avgOlderPrice =
          olderPrices.length > 0
            ? olderPrices.reduce((sum, p) => sum + p.price, 0) / olderPrices.length
            : null;

        const trendPct =
          avgOlderPrice != null && avgOlderPrice > 0
            ? (((avgCurrentPrice - avgOlderPrice) / avgOlderPrice) * 100).toFixed(1)
            : null;
        const trendDirection =
          trendPct === null
            ? "stable"
            : parseFloat(trendPct) > 1
            ? "up"
            : parseFloat(trendPct) < -1
            ? "down"
            : "stable";

        // Predicted price range from prediction table
        const predictedValues = predictions.map((p) => p.predictedPrice);
        const minPredicted =
          predictedValues.length > 0 ? Math.min(...predictedValues) : null;
        const maxPredicted =
          predictedValues.length > 0 ? Math.max(...predictedValues) : null;

        // Best market: the market with the highest latest price
        const marketPriceMap = new Map<string, { name: string; price: number }>();
        for (const p of latestPrices) {
          const existing = marketPriceMap.get(p.marketId);
          if (!existing || p.price > existing.price) {
            marketPriceMap.set(p.marketId, {
              name: p.market.name,
              price: p.price,
            });
          }
        }
        const bestMarket =
          marketPriceMap.size > 0
            ? [...marketPriceMap.values()].sort((a, b) => b.price - a.price)[0]
            : null;

        // Best time to sell: find when predicted prices peak
        let bestSellWindow = "Within 2 weeks";
        if (predictions.length > 0) {
          const peak = predictions.reduce((a, b) =>
            a.predictedPrice > b.predictedPrice ? a : b
          );
          const daysUntilPeak = Math.ceil(
            (new Date(peak.predictionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (daysUntilPeak <= 0) {
            bestSellWindow = "Sell now";
          } else if (daysUntilPeak <= 3) {
            bestSellWindow = "Next 1–3 days";
          } else if (daysUntilPeak <= 7) {
            bestSellWindow = "Next week";
          } else if (daysUntilPeak <= 14) {
            bestSellWindow = "Next 2 weeks";
          } else {
            bestSellWindow = `In ~${daysUntilPeak} days`;
          }
        }

        // Summary sentence
        const trendLabel =
          trendDirection === "up"
            ? `up ${trendPct}% this week`
            : trendDirection === "down"
            ? `down ${Math.abs(parseFloat(trendPct!))}% this week`
            : "stable this week";

        const summary = [
          `${crop.name} prices are ${trendLabel}.`,
          bestMarket
            ? `Best prices currently at ${bestMarket.name} (ZMW ${bestMarket.price.toFixed(2)}).`
            : "",
          predictions.length > 0
            ? `Forecast suggests ${trendDirection === "up" ? "continued growth" : trendDirection === "down" ? "a possible dip" : "stable prices"} ahead.`
            : "",
        ]
          .filter(Boolean)
          .join(" ");

        return {
          cropId: crop.id,
          cropName: crop.name,
          summary,
          trendDirection,
          trendPct: trendPct ? parseFloat(trendPct) : 0,
          avgCurrentPrice: Math.round(avgCurrentPrice * 100) / 100,
          priceRange:
            minPredicted != null && maxPredicted != null
              ? `ZMW ${Math.round(minPredicted)} – ${Math.round(maxPredicted)}`
              : `ZMW ${Math.round(avgCurrentPrice)}`,
          bestSellWindow,
          bestMarket: bestMarket?.name ?? null,
          dataPoints: recentPrices.length,
          marketsCount: marketPriceMap.size,
        };
      })
    );

    // Filter out crops with no price data
    const filteredInsights = insights.filter(Boolean);

    return NextResponse.json({ success: true, data: filteredInsights });
  } catch (error) {
    console.error("❌ Insights API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}