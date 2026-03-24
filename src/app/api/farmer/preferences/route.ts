// src/app/api/farmer/preferences/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-helper";

// ── GET /api/farmer/preferences ───────────────────────────────────────────────
// Returns the farmer's saved preferred crops + markets,
// plus all available crops and markets to pick from.
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Fetch everything in parallel
    const [user, allCrops, allMarkets] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true },
      }),
      prisma.crop.findMany({
        select: { id: true, name: true, category: true, unit: true },
        orderBy: { name: "asc" },
      }),
      prisma.market.findMany({
        select: { id: true, name: true, province: true, district: true },
        orderBy: { name: "asc" },
      }),
      // Fetch user's active price alerts to infer current preferences
    ]);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Preferences are stored as active PriceAlerts (crop+market pairs the user cares about)
    const priceAlerts = await prisma.priceAlert.findMany({
      where: { userId, isActive: true },
      select: {
        cropId: true,
        marketId: true,
        crop: { select: { name: true } },
        market: { select: { name: true } },
      },
    });

    // Derive preferred crop and market names from alerts
    const preferredCropNames = [...new Set(priceAlerts.map((a) => a.crop.name))];
    const preferredMarketNames = [...new Set(priceAlerts.map((a) => a.market.name))];

    return NextResponse.json({
      success: true,
      data: {
        preferredCrops: preferredCropNames,
        preferredMarkets: preferredMarketNames,
        allCrops,
        allMarkets,
      },
    });
  } catch (error) {
    console.error("Preferences GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/farmer/preferences ─────────────────────────────────────────────
// Saves preferred crop names and market names.
// We store preferences by creating PriceAlerts for every
// preferred crop × preferred market combination.
// Existing alerts for non-preferred pairs are deactivated.
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { preferredCrops, preferredMarkets } = body as {
      preferredCrops: string[];
      preferredMarkets: string[];
    };

    if (!Array.isArray(preferredCrops) || !Array.isArray(preferredMarkets)) {
      return NextResponse.json(
        { success: false, error: "preferredCrops and preferredMarkets must be arrays" },
        { status: 400 }
      );
    }

    // Look up crop and market ids from names
    const [crops, markets] = await Promise.all([
      prisma.crop.findMany({
        where: { name: { in: preferredCrops } },
        select: { id: true, name: true },
      }),
      prisma.market.findMany({
        where: { name: { in: preferredMarkets } },
        select: { id: true, name: true },
      }),
    ]);

    // Deactivate all existing alerts first
    await prisma.priceAlert.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Re-create alerts for every crop × market combination
    if (crops.length > 0 && markets.length > 0) {
      const pairs = crops.flatMap((crop) =>
        markets.map((market) => ({ cropId: crop.id, marketId: market.id }))
      );

      for (const pair of pairs) {
        await prisma.priceAlert.upsert({
          where: {
            userId_cropId_marketId: {
              userId,
              cropId: pair.cropId,
              marketId: pair.marketId,
            },
          },
          update: { isActive: true },
          create: {
            userId,
            cropId: pair.cropId,
            marketId: pair.marketId,
            targetPrice: 0, // no specific target — used for preference tracking
            isActive: true,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Preferences saved successfully",
      data: {
        preferredCrops,
        preferredMarkets,
        pairsCreated: crops.length * markets.length,
      },
    });
  } catch (error) {
    console.error("Preferences PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}