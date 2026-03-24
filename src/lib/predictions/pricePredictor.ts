import { prisma } from '@/lib/prisma';
import { RandomForestRegression } from 'ml-random-forest';

export interface PriceSample {
  price: number;
  priceDate: Date;
}

export class PricePredictor {
  /**
   * Generate price predictions for the next `daysToPredict` days.
   * Fetches historical prices from DB, runs Random Forest, saves predictions, returns array.
   */
  static async generatePredictions(
    cropId: string,
    marketId: string,
    daysToPredict: number
  ): Promise<number[]> {
    // Fetch last 30 days of prices
    const prices = await prisma.dailyPrice.findMany({
      where: { cropId, marketId },
      orderBy: { priceDate: 'asc' },
      take: 30,
    });

    if (prices.length < 5) {
      // Not enough data points to predict
      return new Array(daysToPredict).fill(null);
    }

    // Convert prices to PriceSample array
    const samples: PriceSample[] = prices.map(p => ({
      price: p.price,
      priceDate: p.priceDate,
    }));

    // Predict next days
    const predictedPrices = this.randomForestPredict(samples, daysToPredict);

    // Save predictions to DB
    const lastDate = samples[samples.length - 1].priceDate;
    for (let i = 0; i < predictedPrices.length; i++) {
      const predictionDate = new Date(lastDate);
      predictionDate.setDate(lastDate.getDate() + i + 1);

      await prisma.prediction.upsert({
        where: {
          cropId_marketId_predictionDate: {
            cropId,
            marketId,
            predictionDate,
          },
        },
        update: { predictedPrice: predictedPrices[i] },
        create: {
          cropId,
          marketId,
          predictedPrice: predictedPrices[i],
          basedOnDays: 3,
          predictionDate,
        },
      });
    }

    return predictedPrices;
  }

  /**
   * Random Forest Regression prediction
   */
  private static randomForestPredict(
    prices: PriceSample[],
    daysToPredict: number
  ): number[] {
    const startTime = prices[0].priceDate.getTime();

    // X = days since first price
    const X = prices.map(p => [(p.priceDate.getTime() - startTime) / (1000 * 60 * 60 * 24)]);
    const y = prices.map(p => p.price);

    const rf = new RandomForestRegression({
      nEstimators: 50,
      maxFeatures: 1,
      replacement: true,
      seed: 42,
    });

    rf.train(X, y);

    // Future X = next days
    const lastDay = (prices[prices.length - 1].priceDate.getTime() - startTime) / (1000 * 60 * 60 * 24);
    const futureX = [];
    for (let i = 1; i <= daysToPredict; i++) {
      futureX.push([lastDay + i]);
    }

    const predictions = rf.predict(futureX) as number[];
    return predictions;
  }
}