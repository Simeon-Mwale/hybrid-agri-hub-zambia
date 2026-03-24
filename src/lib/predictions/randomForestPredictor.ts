import { RandomForestRegression } from 'ml-random-forest';

interface PriceSample {
  price: number;
  priceDate: Date;
}

// Predict next N days
export function predictFuturePrices(prices: PriceSample[], daysToPredict: number) {
  if (prices.length < 5) return new Array(daysToPredict).fill(null); // need min 5 data points

  // Convert dates to numeric feature: days since first price
  const startTime = prices[0].priceDate.getTime();
  const X = prices.map(p => [(p.priceDate.getTime() - startTime) / (1000*60*60*24)]);
  const y = prices.map(p => p.price);

  // Random Forest setup
  const rf = new RandomForestRegression({
    nEstimators: 50,
    maxFeatures: 1,
    replacement: true,
    seed: 42,
  });

  rf.train(X, y);

  // Predict future days
  const futureX = [];
  const lastDay = (prices[prices.length - 1].priceDate.getTime() - startTime) / (1000*60*60*24);
  for (let i = 1; i <= daysToPredict; i++) {
    futureX.push([lastDay + i]);
  }

  const predictions = rf.predict(futureX) as number[];
  return predictions;
}