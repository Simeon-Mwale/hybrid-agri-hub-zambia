// lib/ussd-menus.ts
import { prisma } from './prisma';
import { formatUSSDResponse } from './africas-talking';
import { USSDSessionData } from './ussd-session';

/**
 * Main Menu (Step 1)
 */
export async function handleMainMenu(sessionId: string, input: string = '') {
  const menu = `Welcome to Agri-Hub!
1. Check Prices
2. Set Price Alert
3. My Alerts
4. Help

Reply with option:`;

  return formatUSSDResponse(menu, false);
}

/**
 * Check Prices - Select Crop
 */
export async function handleSelectCrop(sessionId: string, input: string = '') {
  const crops = await prisma.crop.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  const menu = crops
    .map((c, i) => `${i + 1}. ${c.name}`)
    .join('\n');

  return formatUSSDResponse(`Select Crop:\n${menu}\n\nReply:`, false);
}

/**
 * Check Prices - Select Market
 */
export async function handleSelectMarket(
  sessionId: string,
  input: string,
  sessionData: USSDSessionData
) {
  // Store selected crop
  const crops = await prisma.crop.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });
  const cropIndex = parseInt(input) - 1;
  const selectedCrop = crops[cropIndex];

  if (!selectedCrop) {
    return formatUSSDResponse('Invalid option. Try again:\n1. Back\n2. Exit', false);
  }

  await import('./ussd-session').then(m => m.updateSession(sessionId, 'select_market', {
    cropId: selectedCrop.id,
    cropName: selectedCrop.name
  }));

  const markets = await prisma.market.findMany({
    select: { id: true, name: true, province: true },
    orderBy: { name: 'asc' }
  });

  const menu = markets
    .map((m, i) => `${i + 1}. ${m.name} (${m.province})`)
    .join('\n');

  return formatUSSDResponse(`Select Market:\n${menu}\n\nReply:`, false);
}

/**
 * Show Price + Prediction
 */
export async function handleShowPrice(
  sessionId: string,
  input: string,
  sessionData: USSDSessionData
) {
  const markets = await prisma.market.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });
  const marketIndex = parseInt(input) - 1;
  const selectedMarket = markets[marketIndex];

  if (!selectedMarket || !sessionData.cropId) {
    return formatUSSDResponse('Invalid option. Try again.', false);
  }

  // Fetch latest price
  const latestPrice = await prisma.dailyPrice.findFirst({
    where: {
      cropId: sessionData.cropId,
      marketId: selectedMarket.id
    },
    orderBy: { priceDate: 'desc' }
  });

  // Fetch latest prediction
  const latestPrediction = await prisma.prediction.findFirst({
    where: {
      cropId: sessionData.cropId,
      marketId: selectedMarket.id
    },
    orderBy: { predictionDate: 'desc' }
  });

  const priceText = latestPrice
    ? `Current: K${parseFloat(latestPrice.price.toString()).toFixed(2)}/${sessionData.unit || 'bag'}`
    : 'No price data available';

  const predictionText = latestPrediction
    ? `Predicted: K${parseFloat(latestPrediction.predictedPrice.toString()).toFixed(2)} (${latestPrediction.basedOnDays} days)`
    : 'No prediction available';

  const message = `${sessionData.cropName} @ ${selectedMarket.name}

${priceText}
${predictionText}

1. Check Another
2. Exit`;

  return formatUSSDResponse(message, false);
}

/**
 * Set Price Alert - Flow
 */
export async function handleSetAlert(sessionId: string, input: string, sessionData: USSDSessionData) {
  // This would continue the alert setup flow
  // For brevity, showing a simple version
  return formatUSSDResponse('Alert feature coming soon!\n1. Main Menu\n2. Exit', false);
}

/**
 * Help Message
 */
export async function handleHelp() {
  const message = `Agri-Hub USSD Help:
- Check crop prices
- Get price predictions
- Set price alerts

Dial *384*1234# anytime.

1. Main Menu
2. Exit`;

  return formatUSSDResponse(message, false);
}