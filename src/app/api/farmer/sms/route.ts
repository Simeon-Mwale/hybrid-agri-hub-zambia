import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SmsRequest = { phone: string; message: string };

// Helper: simple trend calculation
function getTrend(prices: number[]): string {
  if (prices.length < 2) return "Stable";
  const diff = prices[prices.length - 1] - prices[prices.length - 2];
  return diff > 0 ? "Increasing" : diff < 0 ? "Decreasing" : "Stable";
}

// Parse SMS: "PRICE MAIZE LUSAKA"
function parseSms(message: string) {
  const parts = message.trim().toUpperCase().split(" ");
  if (parts.length < 3 || parts[0] !== "PRICE") return null;
  const cropName = parts[1];
  const marketName = parts.slice(2).join(" ");
  return { cropName, marketName };
}

export async function POST(req: Request) {
  const { phone, message }: SmsRequest = await req.json();

  // Save to SMS queue for fault tolerance
  const sms = await prisma.smsQueue.create({
    data: { phone, message, status: "PENDING", attempts: 0 },
  });

  const parsed = parseSms(message);
  if (!parsed) {
    await prisma.smsQueue.update({ where: { id: sms.id }, data: { status: "FAILED", response: "Invalid format. Use: PRICE <CROP> <MARKET>" } });
    return NextResponse.json({ success: false, reply: "Invalid format. Use: PRICE <CROP> <MARKET>" });
  }

  const { cropName, marketName } = parsed;

  const crop = await prisma.crop.findUnique({ where: { name: cropName } });
  const market = await prisma.market.findUnique({ where: { name: marketName } });

  if (!crop || !market) {
    await prisma.smsQueue.update({ where: { id: sms.id }, data: { status: "FAILED", response: "Crop or Market not found" } });
    return NextResponse.json({ success: false, reply: "Crop or Market not found" });
  }

  // Get last 7 days prices
  const today = new Date();
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(today.getDate() - 6);

  const prices = await prisma.dailyPrice.findMany({
    where: { cropId: crop.id, marketId: market.id, priceDate: { gte: sevenDaysAgo, lte: today } },
    orderBy: { priceDate: "asc" },
  });

  if (!prices.length) {
    await prisma.smsQueue.update({ where: { id: sms.id }, data: { status: "FAILED", response: "No price data available" } });
    return NextResponse.json({ success: false, reply: "No price data available" });
  }

  // Current price
  const currentPrice = prices[prices.length - 1].price;

  // Simple 3-day moving average prediction
  let predictedPrice = currentPrice;
  if (prices.length >= 3) {
    const last3 = prices.slice(-3).map(p => p.price);
    predictedPrice = last3.reduce((a, b) => a + b, 0) / 3;
  }

  const trend = getTrend(prices.map(p => p.price));

  // Check price alerts
  const alerts = await prisma.priceAlert.findMany({
    where: { cropId: crop.id, marketId: market.id, targetPrice: { lte: currentPrice }, isActive: true },
  });

  // Build reply message
  let reply = `${crop.name} - ${market.name}\nCurrent: K${currentPrice}\nPrediction: K${predictedPrice.toFixed(2)}\nTrend: ${trend}`;
  if (alerts.length) reply += `\nPrice Alert: target reached!`;

  // Update SMS queue
  await prisma.smsQueue.update({
    where: { id: sms.id },
    data: { status: "SENT", response: reply, processedAt: new Date() },
  });

  return NextResponse.json({ success: true, reply });
}
