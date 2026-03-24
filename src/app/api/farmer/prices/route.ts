// src/app/api/farmer/prices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // ✅ Use the same custom JWT the middleware uses — no more 401 mismatch
    const payload = await getAuthPayload();

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page   = parseInt(searchParams.get("page")  || "1");
    const limit  = parseInt(searchParams.get("limit") || "10");
    const crop   = searchParams.get("crop");
    const market = searchParams.get("market");
    const search = searchParams.get("search");
    const from   = searchParams.get("from");
    const to     = searchParams.get("to");

    // ── Build where clause ────────────────────────────────────────────────────
    const where: any = {};

    if (crop)   where.crop   = { name: crop };
    if (market) where.market = { name: market };

    if (search) {
      where.OR = [
        { crop:   { name: { contains: search } } },
        { market: { name: { contains: search } } },
      ];
    }

    if (from || to) {
      where.priceDate = {};
      if (from) where.priceDate.gte = new Date(from);
      if (to)   where.priceDate.lte = new Date(to);
    }

    // ── Query ─────────────────────────────────────────────────────────────────
    const [total, prices] = await Promise.all([
      prisma.dailyPrice.count({ where }),
      prisma.dailyPrice.findMany({
        where,
        include: { crop: true, market: true },
        orderBy: { priceDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // ── Enrich with trends & predictions ─────────────────────────────────────
    // Batch-fetch all previous prices in parallel instead of serial awaits
    const pricesWithTrends = await Promise.all(
      prices.map(async (price) => {
        const previousPrice = await prisma.dailyPrice.findFirst({
          where: {
            cropId:    price.cropId,
            marketId:  price.marketId,
            priceDate: { lt: price.priceDate },
          },
          orderBy: { priceDate: "desc" },
        });

        // Simple 5 % forward prediction — swap with your model when ready
        const predictedPrice = parseFloat((price.price * 1.05).toFixed(2));

        const prev = previousPrice?.price;
        const trend =
          prev === undefined ? "stable"
          : price.price > prev ? "up"
          : price.price < prev ? "down"
          : "stable";

        return {
          id:             price.id,
          cropId:         price.cropId,
          cropName:       price.crop.name,
          marketId:       price.marketId,
          marketName:     price.market.name,
          price:          price.price,
          predictedPrice,
          previousPrice:  prev,
          trend,
          lastUpdated:    price.priceDate.toISOString(),
          priceDate:      price.priceDate.toISOString(),
          unit:           price.crop.unit,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: pricesWithTrends,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("GET /api/farmer/prices error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}