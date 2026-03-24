import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPredictions } from "@/lib/prediction-client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "supersecret"
);

async function getAdminUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as { id: string; role: string };
    if (p.role !== "ADMIN") return null;
    return p.id;
  } catch {
    return null;
  }
}

// ── POST /api/admin/prices/daily ──────────────────────────────────────────────
// Body: { cropId, marketId, price, priceDate? }
export async function POST(request: NextRequest) {
  try {
    const userId = await getAdminUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { cropId, marketId, price, priceDate } = body;

    if (!cropId || !marketId || price == null) {
      return NextResponse.json(
        { success: false, error: "cropId, marketId and price are required" },
        { status: 400 }
      );
    }

    if (price <= 0) {
      return NextResponse.json(
        { success: false, error: "Price must be greater than 0" },
        { status: 400 }
      );
    }

    const date = priceDate ? new Date(priceDate) : new Date();
    date.setHours(0, 0, 0, 0);

    const saved = await prisma.dailyPrice.upsert({
      where: { cropId_marketId_priceDate: { cropId, marketId, priceDate: date } },
      update: { price, createdBy: userId },
      create: { cropId, marketId, price, priceDate: date, createdBy: userId },
      include: {
        crop:   { select: { name: true } },
        market: { select: { name: true } },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type:        "PRICE_ENTRY",
        description: `Price entered: ${saved.crop.name} @ ${saved.market.name} — ZMW ${price.toFixed(2)}`,
        status:      "SUCCESS",
        userId,
      },
    });

    // Trigger predictions in background — don't block response
    triggerPredictions(cropId, marketId, saved.crop.name, saved.market.name).catch(
      (err) => console.error("Background prediction error:", err)
    );

    return NextResponse.json({
      success: true,
      data:    saved,
      message: `Price saved for ${saved.crop.name} at ${saved.market.name}. Predictions updating in background.`,
    });

  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Price for this date already exists. Use PUT to update." },
        { status: 409 }
      );
    }
    console.error("Daily price POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ── PUT /api/admin/prices/daily — Batch upsert ────────────────────────────────
// Body: { entries: [{ cropId, marketId, price, priceDate? }] }
export async function PUT(request: NextRequest) {
  try {
    const userId = await getAdminUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { entries } = await request.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, error: "entries array is required" },
        { status: 400 }
      );
    }

    const saved  = [];
    const errors = [];

    for (const entry of entries) {
      const { cropId, marketId, price, priceDate } = entry;

      if (!cropId || !marketId || price == null || price <= 0) {
        errors.push({ entry, error: "Invalid entry — missing or invalid fields" });
        continue;
      }

      const date = priceDate ? new Date(priceDate) : new Date();
      date.setHours(0, 0, 0, 0);

      try {
        const result = await prisma.dailyPrice.upsert({
          where: { cropId_marketId_priceDate: { cropId, marketId, priceDate: date } },
          update: { price, createdBy: userId },
          create: { cropId, marketId, price, priceDate: date, createdBy: userId },
          include: {
            crop:   { select: { name: true } },
            market: { select: { name: true } },
          },
        });
        saved.push(result);
      } catch (err) {
        errors.push({ entry, error: String(err) });
      }
    }

    // Log activity
    if (saved.length > 0) {
      await prisma.activity.create({
        data: {
          type:        "PRICE_BATCH_ENTRY",
          description: `Batch price entry: ${saved.length} prices saved, ${errors.length} failed`,
          status:      errors.length === 0 ? "SUCCESS" : "PARTIAL",
          userId,
          metadata:    JSON.stringify({ saved: saved.length, errors: errors.length }),
        },
      });
    }

    // Trigger predictions for all unique crop+market pairs
    const seen = new Set<string>();
    for (const s of saved) {
      const key = `${s.cropId}||${s.marketId}`;
      if (!seen.has(key)) {
        seen.add(key);
        triggerPredictions(s.cropId, s.marketId, s.crop.name, s.market.name).catch(
          (err) => console.error("Background prediction error:", err)
        );
      }
    }

    return NextResponse.json({
      success:      true,
      saved:        saved.length,
      errors:       errors.length,
      errorDetails: errors,
    });

  } catch (error) {
    console.error("Batch price PUT error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ── Background prediction trigger ─────────────────────────────────────────────

async function triggerPredictions(
  cropId:     string,
  marketId:   string,
  cropName:   string,
  marketName: string
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const history = await prisma.dailyPrice.findMany({
    where:   { cropId, marketId, priceDate: { gte: cutoff } },
    orderBy: { priceDate: "asc" },
    select:  { price: true, priceDate: true },
  });

  if (history.length < 3) {
    console.log(`⚠ Not enough data for ${cropName} @ ${marketName} (${history.length} points)`);
    return;
  }

  const result = await getPredictions({
    crop_name:   cropName,
    market_name: marketName,
    prices:      history.map((h) => h.price),
    dates:       history.map((h) => h.priceDate.toISOString().split("T")[0]),
    steps:       5,
    month:       new Date().getMonth() + 1,
  });

  if (!result) {
    console.log(`⚠ No prediction result for ${cropName} @ ${marketName}`);
    return;
  }

  for (let i = 0; i < result.predictions.length; i++) {
    const predictionDate = new Date(result.prediction_dates[i]);
    predictionDate.setHours(0, 0, 0, 0);

    await prisma.prediction.upsert({
      where: {
        crop_market_prediction_unique: { cropId, marketId, predictionDate },
      },
      update: {
        predictedPrice: result.predictions[i],
        basedOnDays:    history.length,
      },
      create: {
        cropId,
        marketId,
        predictedPrice: result.predictions[i],
        basedOnDays:    history.length,
        predictionDate,
      },
    });
  }

  console.log(
    `✓ Predictions saved for ${cropName} @ ${marketName} — ` +
    `${result.model_used} (${result.confidence} confidence, trend: ${result.trend})`
  );
}