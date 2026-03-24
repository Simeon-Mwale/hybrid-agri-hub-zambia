// lib/prediction-client.ts

const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://localhost:8000';
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret';

/**
 * Check if Python prediction service is reachable
 */
export async function checkPredictionService(): Promise<boolean> {
  try {
    const response = await fetch(`${PREDICTION_SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET
      },
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get batch predictions from Python service OR fallback to local logic
 */
export async function getBatchPredictions(batchRequests: any[]): Promise<any[]> {
  // ✅ Check if fallback mode is enabled via env var
  const useFallback = process.env.USE_FALLBACK_PREDICTIONS === 'true';
  
  // ✅ If fallback enabled, use local predictions immediately
  if (useFallback) {
    console.log('🔄 Using FALLBACK prediction mode (local calculations)');
    return generateFallbackPredictions(batchRequests);
  }

  try {
    console.log('🌐 Calling Python prediction service...');
    
    // ✅✅✅ SINGLE, CLEAN fetch call (no duplicates)
    const response = await fetch(`${PREDICTION_SERVICE_URL}/predict/batch`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET  // ✅ Match your Python service
      },
      body: JSON.stringify({ requests: batchRequests }),
      // ✅ Increased from 10s to 60s for batch predictions
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Prediction service returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data;
    }
    if (data.predictions && Array.isArray(data.predictions)) {
      return data.predictions;
    }
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    
    console.warn('⚠️ Unexpected prediction response format:', Object.keys(data));
    return [];
    
  } catch (error) {
    console.error('❌ Python service error, falling back to local predictions:', error);
    
    // ✅ Auto-fallback to local predictions on error
    return generateFallbackPredictions(batchRequests);
  }
}

/**
 * ✅ Fallback: Generate simple predictions locally using moving average + trend
 */
function generateFallbackPredictions(batchRequests: any[]): any[] {
  return batchRequests.map(req => {
    const prices = req.prices || [];
    
    if (prices.length === 0) {
      return {
        crop_name: req.crop_name,
        market_name: req.market_name,
        predictions: [],
        prediction_dates: [],
        model_used: 'fallback_no_data'
      };
    }

    // Calculate simple moving average of last 7 prices
    const recent = prices.slice(-7);
    const avg = recent.reduce((sum: number, p: number) => sum + p, 0) / recent.length;
    
    // Generate 7-day forecast with slight upward trend + small noise
    const predictions: number[] = [];
    const predictionDates: string[] = [];
    const lastDate = new Date(req.dates[req.dates.length - 1] || Date.now());
    
    for (let i = 1; i <= 7; i++) {
      // 1-3% daily trend + random noise
      const trend = 1 + (i * 0.015) + (Math.random() - 0.5) * 0.02;
      const predictedPrice = Math.round(avg * trend * 100) / 100;
      
      const predDate = new Date(lastDate);
      predDate.setDate(predDate.getDate() + i);
      
      predictions.push(predictedPrice);
      predictionDates.push(predDate.toISOString().slice(0, 10));
    }
    
    return {
      crop_name: req.crop_name,
      market_name: req.market_name,
      predictions,
      prediction_dates: predictionDates,
      model_used: 'fallback_moving_average'
    };
  });
}