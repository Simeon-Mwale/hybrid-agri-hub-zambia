// app/api/admin/predictions/trigger/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toMetadataString, type PredictionActivityMetadata } from '@/lib/utils';

export async function POST() {
  const startTime = Date.now();

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. FETCH ALL REFERENCE DATA (2 Queries - Run in Parallel)
    // ─────────────────────────────────────────────────────────────
    const [crops, markets] = await Promise.all([
      prisma.crop.findMany({
        select: { id: true, name: true, category: true }
      }),
      prisma.market.findMany({
        select: { id: true, name: true, province: true }
      })
    ]);

    // ─────────────────────────────────────────────────────────────
    // 2. FETCH ALL PRICE HISTORY IN ONE GO (1 Query)
    // ─────────────────────────────────────────────────────────────
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Look back 90 days

    const allPrices = await prisma.dailyPrice.findMany({
      where: {
        priceDate: { gte: startDate }
        // Optional optimization for large datasets:
        // cropId: { in: crops.map(c => c.id) },
        // marketId: { in: markets.map(m => m.id) },
      },
      select: {
        cropId: true,
        marketId: true,
        price: true,
        priceDate: true
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. ORGANIZE DATA IN MEMORY (Fast JavaScript Operation)
    // ─────────────────────────────────────────────────────────────
    const priceMap = new Map<string, typeof allPrices>();
    
    allPrices.forEach(p => {
      const key = `${p.cropId}-${p.marketId}`;
      if (!priceMap.has(key)) {
        priceMap.set(key, []);
      }
      priceMap.get(key)!.push(p);
    });

    // ─────────────────────────────────────────────────────────────
    // 4. PROCESS PREDICTIONS (No Database Calls Here!)
    // ─────────────────────────────────────────────────────────────
    const predictions: Array<{
      cropId: string;
      marketId: string;
      predictedPrice: number;
      basedOnDays: number;
      predictionDate: Date;
    }> = [];

    for (const crop of crops) {
      for (const market of markets) {
        const key = `${crop.id}-${market.id}`;
        const history = priceMap.get(key) || [];

        // Skip if not enough data for meaningful prediction
        if (history.length < 7) continue; 

        // Sort by date ascending (oldest → newest)
        history.sort((a, b) => 
          new Date(a.priceDate).getTime() - new Date(b.priceDate).getTime()
        );

        // ✅ Run your prediction algorithm here
        const predictedPrice = calculatePrediction(history); 

        predictions.push({
          cropId: crop.id,
          marketId: market.id,
          predictedPrice,
          basedOnDays: history.length,
          predictionDate: new Date()
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. SAVE PREDICTIONS (Batch Insert - Single Query)
    // ─────────────────────────────────────────────────────────────
    if (predictions.length > 0) {
      await prisma.prediction.createMany({
        data: predictions
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. LOG SUCCESS ACTIVITY (with JSON.stringified metadata)
    // ─────────────────────────────────────────────────────────────
    const meta: PredictionActivityMetadata = {
      duration: Date.now() - startTime,
      count: predictions.length,
      cropsProcessed: crops.length,
      marketsProcessed: markets.length
    };

    await prisma.activity.create({
      data: {
        type: 'PREDICTION_GENERATED',
        description: `Generated ${predictions.length} predictions`,
        status: 'COMPLETED',
        // ✅ SQLite-compatible: stringify the object
        metadata: toMetadataString(meta)
      }
    });

    return NextResponse.json({ 
      success: true, 
      count: predictions.length,
      duration: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    console.error('Prediction error:', error);
    
    // ─────────────────────────────────────────────────────────────
    // 7. LOG ERROR ACTIVITY (with JSON.stringified metadata)
    // ─────────────────────────────────────────────────────────────
    const errorMeta: PredictionActivityMetadata = {
      duration: Date.now() - startTime,
      error: String(error),
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    };

    await prisma.activity.create({
      data: {
        type: 'PREDICTION_FAILED',
        // ✅ 'description' is required — include error message
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        status: 'FAILED',
        // ✅ SQLite-compatible: stringify the object
        metadata: toMetadataString(errorMeta)
      }
    });

    return NextResponse.json(
      { success: false, error: 'Failed to generate predictions' }, 
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PREDICTION ALGORITHM (Replace with your actual logic)
// ─────────────────────────────────────────────────────────────
function calculatePrediction(history: Array<{ price: number | string; priceDate: Date }>): number {
  // Simple moving average example - replace with ML model, ARIMA, etc.
  const prices = history.map(h => parseFloat(h.price.toString()));
  
  if (prices.length === 0) return 0;
  
  const sum = prices.reduce((acc, price) => acc + price, 0);
  const avg = sum / prices.length;
  
  // Optional: Add trend adjustment, seasonality, etc.
  return Math.round(avg * 100) / 100; // Round to 2 decimal places
}