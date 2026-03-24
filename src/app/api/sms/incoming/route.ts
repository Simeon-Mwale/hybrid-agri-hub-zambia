// src/app/api/sms/incoming/route.ts
// Africa's Talking posts inbound SMS here.
// Set callback URL in AT dashboard: https://yourdomain.com/api/sms/incoming
//
// Farmers can text:
//   "MAIZE LUSAKA"          → price
//   "PREDICT MAIZE LUSAKA"  → prediction
//   "REGISTER John Banda"   → register
//   "ALERT MAIZE LUSAKA 200"→ set alert
//   "HELP"                  → usage info

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrQueueSMS } from "@/lib/sms-queue";

// ── Price lookup ──────────────────────────────────────────────────────────────

async function lookupPrice(cropName: string, marketName: string) {
  const [crop, market] = await Promise.all([
    prisma.crop.findFirst({ where: { name: { equals: cropName } } }),
    prisma.market.findFirst({ where: { name: { equals: marketName } } }),
  ]);

  if (!crop || !market) return null;

  const [price, prediction] = await Promise.all([
    prisma.dailyPrice.findFirst({
      where: { cropId: crop.id, marketId: market.id },
      orderBy: { priceDate: "desc" },
    }),
    prisma.prediction.findFirst({
      where: { cropId: crop.id, marketId: market.id },
      orderBy: { predictionDate: "desc" },
    }),
  ]);

  return price
    ? { crop: crop.name, market: market.name, unit: crop.unit || "50kg bag",
        price: price.price, predictedPrice: prediction?.predictedPrice ?? null,
        priceDate: price.priceDate }
    : null;
}

// ── SMS command parser ────────────────────────────────────────────────────────

async function handleSmsCommand(from: string, rawText: string): Promise<string> {
  const text  = rawText.trim().toUpperCase();
  const parts = text.split(/\s+/);

  // HELP
  if (parts[0] === "HELP" || parts.length === 0) {
    return (
      "AgriHub SMS Commands:\n" +
      "MAIZE LUSAKA - Get price\n" +
      "PREDICT MAIZE LUSAKA - Get prediction\n" +
      "ALERT MAIZE LUSAKA 200 - Set price alert\n" +
      "REGISTER John Banda - Register as farmer\n" +
      "Dial *384*123# for full menu."
    );
  }

  // REGISTER <full name>
  if (parts[0] === "REGISTER") {
    const fullName = rawText.trim().substring(9).trim(); // preserve original casing
    if (!fullName || fullName.length < 2) {
      return "Please include your full name. Example: REGISTER John Banda";
    }

    const existing = await prisma.farmerRegistration.findUnique({ where: { phoneNumber: from } });
    if (existing) {
      return `You are already registered as ${existing.fullName ?? "a farmer"}. Dial *384*123# to check prices.`;
    }

    await prisma.farmerRegistration.create({
      data: { phoneNumber: from, fullName, channel: "sms" },
    });

    return (
      `Welcome to AgriHub, ${fullName}!\n` +
      `You are now registered.\n` +
      `Text MAIZE LUSAKA to check prices.\n` +
      `Text HELP for all commands.`
    );
  }

  // PREDICT <crop> <market>
  if (parts[0] === "PREDICT" && parts.length >= 3) {
    const cropName   = parts[1];
    const marketName = parts[2];
    const result     = await lookupPrice(cropName, marketName);

    if (!result) {
      return `No data found for ${cropName} in ${marketName}. Check spelling and try again.`;
    }

    const predText = result.predictedPrice
      ? `Predicted: ZMW ${result.predictedPrice.toFixed(2)}/${result.unit}`
      : "No prediction available yet.";

    return `${result.crop} - ${result.market}\nCurrent: ZMW ${result.price.toFixed(2)}/${result.unit}\n${predText}`;
  }

  // ALERT <crop> <market> <targetPrice>
  if (parts[0] === "ALERT" && parts.length >= 4) {
    const cropName    = parts[1];
    const marketName  = parts[2];
    const targetPrice = parseFloat(parts[3]);

    if (isNaN(targetPrice) || targetPrice <= 0) {
      return "Invalid price. Example: ALERT MAIZE LUSAKA 200";
    }

    const reg = await prisma.farmerRegistration.findUnique({ where: { phoneNumber: from } });
    if (!reg) {
      return "Please register first. Text: REGISTER Your Full Name";
    }
    if (!reg.userId) {
      return "Your phone is registered but not yet linked to a web account. Please log in at agriHub.com to link your account.";
    }

    const [crop, market] = await Promise.all([
      prisma.crop.findFirst({ where: { name: { equals: cropName } } }),
      prisma.market.findFirst({ where: { name: { equals: marketName } } }),
    ]);

    if (!crop || !market) {
      return `Crop or market not found. Text HELP for guidance.`;
    }

    await prisma.priceAlert.create({
      data: { userId: reg.userId, cropId: crop.id, marketId: market.id, targetPrice, isActive: true },
    });

    return `Alert set! You will receive an SMS when ${crop.name} in ${market.name} reaches ZMW ${targetPrice.toFixed(2)}.`;
  }

  // <crop> <market>  — simple price lookup (e.g. "MAIZE LUSAKA")
  if (parts.length >= 2) {
    const cropName   = parts[0];
    const marketName = parts[1];
    const result     = await lookupPrice(cropName, marketName);

    if (!result) {
      return (
        `No price found for ${cropName} in ${marketName}.\n` +
        `Check spelling or text HELP for commands.`
      );
    }

    const dateStr = new Date(result.priceDate).toLocaleDateString("en-ZM", {
      day: "numeric", month: "short",
    });

    const predText = result.predictedPrice
      ? `\nPredicted: ZMW ${result.predictedPrice.toFixed(2)}/${result.unit}`
      : "";

    return (
      `${result.crop} - ${result.market}\n` +
      `Price: ZMW ${result.price.toFixed(2)}/${result.unit}\n` +
      `Updated: ${dateStr}` +
      predText
    );
  }

  return "Unknown command. Text HELP for available commands.";
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    const from = params.get("from") || "";
    const text = params.get("text") || "";

    if (!from || !text) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const reply = await handleSmsCommand(from, text);

    // Send reply back via Africa's Talking
    await sendOrQueueSMS(from, reply);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Inbound SMS handler error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}