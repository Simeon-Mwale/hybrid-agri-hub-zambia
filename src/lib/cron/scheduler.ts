import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { getBatchPredictions, checkPredictionService } from '@/lib/prediction-client';

// ── Process SMS queue every minute ──────────────────────────────────────────
cron.schedule('* * * * *', async () => {
  console.log('[CRON] Processing SMS queue...');
  try {
    // SMSService.processQueue() — keep your existing call here
  } catch (err) {
    console.error('[CRON] SMS queue error:', err);
  }
});

// ── Check price alerts every hour ────────────────────────────────────────────
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Checking price alerts...');
  try {
    // PriceAlertChecker.checkAlerts() — keep your existing call here
  } catch (err) {
    console.error('[CRON] Alert check error:', err);
  }
});

// ── Generate predictions every day at midnight ───────────────────────────────
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Starting nightly ML predictions...');

  try {
    const serviceUp = await checkPredictionService();
    if (!serviceUp) {
      console.error('[CRON] FastAPI prediction service is not running — skipping predictions');
      return;
    }

    const allCrops   = await prisma.crop.findMany();
    const allMarkets = await prisma.market.findMany();

    const batchRequests = [];

    for (const crop of allCrops) {
      for (const market of allMarkets) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);

        const prices = await prisma.dailyPrice.findMany({
          where: {
            cropId:    crop.id,
            marketId:  market.id,
            priceDate: { gte: fromDate },
          },
          orderBy: { priceDate: 'asc' },
        });

        if (prices.length < 3) continue;

        batchRequests.push({
          crop_name:   crop.name,
          market_name: market.name,
          prices:      prices.map((p) => p.price),
          dates:       prices.map((p) => p.priceDate.toISOString().slice(0, 10)),
          steps:       7,
          month:       new Date().getMonth() + 1,
          _cropId:     crop.id,
          _marketId:   market.id,
        });
      }
    }

    if (batchRequests.length === 0) {
      console.log('[CRON] No data to predict — skipping');
      return;
    }

    const results = await getBatchPredictions(batchRequests as any);

    let saved = 0;
    let failed = 0;

    for (const result of results) {
      const req = batchRequests.find(
        (r) => r.crop_name === result.crop_name && r.market_name === result.market_name
      ) as any;

      if (!req) continue;

      for (let i = 0; i < result.predictions.length; i++) {
        const predictionDate = new Date(result.prediction_dates[i]);
        predictionDate.setHours(0, 0, 0, 0);

        try {
          await prisma.prediction.upsert({
            where: {
              crop_market_prediction_unique: {
                cropId:         req._cropId,
                marketId:       req._marketId,
                predictionDate: predictionDate,
              },
            },
            update: { predictedPrice: result.predictions[i] },
            create: {
              cropId:         req._cropId,
              marketId:       req._marketId,
              predictedPrice: result.predictions[i],
              basedOnDays:    90,
              predictionDate: predictionDate,
            },
          });
          saved++;
        } catch {
          failed++;
        }
      }
    }

    // Log to activity
    await prisma.activity.create({
      data: {
        type:        'PREDICTION',
        description: `Nightly ML predictions: ${results.length} pairs, ${saved} saved, ${failed} failed`,
        status:      'SUCCESS',
        metadata:    JSON.stringify({
          pairs:  results.length,
          saved,
          failed,
          models: [...new Set(results.map((r) => r.model_used))],
        }),
      },
    });

    console.log(`[CRON] Predictions done — ${saved} saved, ${failed} failed across ${results.length} pairs`);

  } catch (error) {
    console.error('[CRON] Prediction error:', error);
  }
});

// ── Clean up old SMS records weekly (Sunday at 2 AM) ─────────────────────────
cron.schedule('0 2 * * 0', async () => {
  console.log('[CRON] Cleaning up old SMS records...');
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    await prisma.smsQueue.deleteMany({
      where: {
        createdAt: { lt: oneMonthAgo },
        status:    'SENT',
      },
    });
    console.log('[CRON] Old SMS records cleaned');
  } catch (err) {
    console.error('[CRON] SMS cleanup error:', err);
  }
});