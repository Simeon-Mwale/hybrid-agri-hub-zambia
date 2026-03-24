// src/app/api/cron/daily-predictions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBatchPredictions, checkPredictionService } from "@/lib/prediction-client";

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Secure the endpoint
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check Python service (fallback mode preserved)
    const serviceUp = await checkPredictionService();
    if (!serviceUp) {
      console.warn("⚠️ Prediction service not reachable, using fallback mode");
    }

    // Fetch reference data
    const [allCrops, allMarkets] = await Promise.all([
      prisma.crop.findMany({ select: { id: true, name: true } }),
      prisma.market.findMany({ select: { id: true, name: true } })
    ]);

    // Build batch requests
    const batchRequests: any[] = [];
    for (const crop of allCrops) {
      for (const market of allMarkets) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);

        const prices = await prisma.dailyPrice.findMany({
          where: {
            cropId: crop.id,
            marketId: market.id,
            priceDate: { gte: fromDate },
          },
          orderBy: { priceDate: "asc" },
          select: { price: true, priceDate: true }
        });

        if (prices.length < 3) continue;

        batchRequests.push({
          crop_name: crop.name,
          market_name: market.name,
          prices: prices.map((p) => p.price),
          dates: prices.map((p) => p.priceDate.toISOString().slice(0, 10)),
          steps: 7,
          month: new Date().getMonth() + 1,
          _cropId: crop.id,
          _marketId: market.id,
        });
      }
    }

    if (batchRequests.length === 0) {
      return NextResponse.json({ success: true, message: "No data to predict", pairs: 0 });
    }

    // Call prediction service
    const results = await getBatchPredictions(batchRequests);
    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, message: "No predictions generated", pairs: 0, fallback_used: true });
    }

    // ✅✅✅ BATCH SAVE: Use createMany with "" key (NOT "batch:", NOT skipDuplicates)
    const predictionsToSave: Array<{
      cropId: string;
      marketId: string;
      predictedPrice: number;
      basedOnDays: number;
      predictionDate: Date;
    }> = [];

    for (const result of results) {
      const req = batchRequests.find(
        (r) => r.crop_name === result.crop_name && r.market_name === result.market_name
      );
      if (!req || !result.predictions?.length) continue;

      for (let i = 0; i < result.predictions.length; i++) {
        const predictionDate = new Date(result.prediction_dates[i]);
        predictionDate.setHours(0, 0, 0, 0);
        predictionsToSave.push({
          cropId: req._cropId,
          marketId: req._marketId,
          predictedPrice: result.predictions[i],
          basedOnDays: 90,
          predictionDate,
        });
      }
    }

    // Batch insert in chunks
    let saved = 0;
    let failed = 0;
    for (let i = 0; i < predictionsToSave.length; i += BATCH_SIZE) {
      const batch = predictionsToSave.slice(i, i + BATCH_SIZE);
      try {
        // ✅✅✅ CRITICAL: Use "" key, NO skipDuplicates for SQLite
        await prisma.prediction.createMany({
          data: batch
        });
        saved += batch.length;
      } catch (error) {
        // Fallback to individual upserts if batch fails
        for (const pred of batch) {
          try {
            await prisma.prediction.upsert({
              where: {
                crop_market_prediction_unique: {
                  cropId: pred.cropId,
                  marketId: pred.marketId,
                  predictionDate: pred.predictionDate,
                },
              },
              update: { predictedPrice: pred.predictedPrice },
              create: pred,
            });
            saved++;
          } catch {
            failed++;
          }
        }
      }
    }

    // Log activity ✅✅✅ Use "" + "meta" (not "meta")
    const modelsUsed = [...new Set(results.map((r: any) => r.model_used).filter(Boolean))];
    const duration = Date.now() - startTime;

    await prisma.activity.create({
       {  // ✅ "" key required
        type: "PREDICTION",
        description: `ML predictions generated for ${results.length} crop-market pairs (${saved} saved, ${failed} failed)`,
        status: "SUCCESS",
        metadata: JSON.stringify({  // ✅ "meta" not "meta"
          pairs: results.length,
          saved,
          failed,
          models: modelsUsed,
          duration,
          fallback_used: !serviceUp
        })
      }
    });

    return NextResponse.json({
      success: true,
      pairs: results.length,
      saved,
      failed,
      models_used: modelsUsed,
      duration: `${duration}ms`,
      fallback_used: !serviceUp
    });

  } catch (error) {
    console.error("❌ Daily predictions cron error:", error);
    
    try {
      await prisma.activity.create({
         {  // ✅ "" key required
          type: "PREDICTION",
          description: `Error: ${error instanceof Error ? error.message : String(error)}`,
          status: "FAILED",
          metadata: JSON.stringify({ error: String(error) })  // ✅ "meta" not "meta"
        }
      });
    } catch (logError) {
      console.error("Failed to log activity:", logError);
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate predictions" },
      { status: 500 }
    );
  }
}