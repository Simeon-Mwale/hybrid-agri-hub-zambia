import { prisma } from "@/lib/prisma";
import { ussdCon, ussdEnd } from "@/lib/africastalking";
import { sendOrQueueSMS } from "@/lib/sms-queue";

async function getSession(sessionId: string, phoneNumber: string) {
  return prisma.ussdSession.upsert({
    where:  { sessionId },
    update: { updatedAt: new Date() },
    create: { sessionId, phoneNumber, step: "main", data: "{}" },
  });
}

async function updateSession(sessionId: string, step: string, data: object) {
  return prisma.ussdSession.update({
    where: { sessionId },
    data:  { step, data: JSON.stringify(data) },
  });
}

async function clearSession(sessionId: string) {
  await prisma.ussdSession.deleteMany({ where: { sessionId } });
}

async function getPriceData(cropName: string, marketName: string) {
  const [crop, market] = await Promise.all([
    prisma.crop.findFirst({ where: { name: { equals: cropName } } }),
    prisma.market.findFirst({ where: { name: { equals: marketName } } }),
  ]);

  if (!crop || !market) return null;

  const [price, prediction] = await Promise.all([
    prisma.dailyPrice.findFirst({
      where:   { cropId: crop.id, marketId: market.id },
      orderBy: { priceDate: "desc" },
    }),
    prisma.prediction.findFirst({
      where:   { cropId: crop.id, marketId: market.id },
      orderBy: { predictionDate: "desc" },
    }),
  ]);

  if (!price) return null;

  return {
    crop:           crop.name,
    market:         market.name,
    unit:           crop.unit || "50kg bag",
    price:          price.price,
    predictedPrice: prediction?.predictedPrice ?? null,
    priceDate:      price.priceDate,
  };
}

async function getCrops() {
  return prisma.crop.findMany({ orderBy: { name: "asc" }, take: 8 });
}

async function getMarkets() {
  return prisma.market.findMany({ orderBy: { name: "asc" }, take: 8 });
}

export async function handleUSSD(params: {
  sessionId:   string;
  phoneNumber: string;
  text:        string;
  serviceCode: string;
}) {
  const { sessionId, phoneNumber, text } = params;

  await prisma.ussdRequest.create({
    data: { phoneNumber, sessionId, input: text, response: "" },
  }).catch(() => {});

  const session = await getSession(sessionId, phoneNumber);
  const inputs  = text ? text.split("*") : [];
  const level   = inputs.length;
  const data    = JSON.parse(session.data || "{}");

  // Main menu
  if (!text) {
    await updateSession(sessionId, "main", {});
    return ussdCon(
      "Welcome to AgriHub Zambia\n" +
      "1. Check Crop Prices\n" +
      "2. Price Predictions\n" +
      "3. Set Price Alert\n" +
      "4. Register\n" +
      "0. Exit"
    );
  }

  const choice = inputs[0];

  if (choice === "0") {
    await clearSession(sessionId);
    return ussdEnd("Thank you for using AgriHub. Goodbye!");
  }

  // 1. Check Prices
  if (choice === "1") {
    if (level === 1) {
      const crops = await getCrops();
      const menu  = crops.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      await updateSession(sessionId, "prices_crop", { crops: crops.map((c) => c.name) });
      return ussdCon(`Select crop:\n${menu}`);
    }
    if (level === 2) {
      const cropName = data.crops?.[parseInt(inputs[1]) - 1];
      if (!cropName) return ussdEnd("Invalid selection. Try again.");
      const markets = await getMarkets();
      const menu    = markets.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
      await updateSession(sessionId, "prices_market", { ...data, selectedCrop: cropName, markets: markets.map((m) => m.name) });
      return ussdCon(`Select market:\n${menu}`);
    }
    if (level === 3) {
      const marketName = data.markets?.[parseInt(inputs[2]) - 1];
      const cropName   = data.selectedCrop;
      if (!marketName || !cropName) return ussdEnd("Invalid selection. Try again.");
      const result = await getPriceData(cropName, marketName);
      await clearSession(sessionId);
      if (!result) return ussdEnd(`No price data for ${cropName} in ${marketName}.`);
      const dateStr = new Date(result.priceDate).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });
      return ussdEnd(`${result.crop} - ${result.market}\nPrice: ZMW ${result.price.toFixed(2)}/${result.unit}\nUpdated: ${dateStr}\nDial *384*123# for more.`);
    }
  }

  // 2. Predictions
  if (choice === "2") {
    if (level === 1) {
      const crops = await getCrops();
      const menu  = crops.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      await updateSession(sessionId, "predict_crop", { crops: crops.map((c) => c.name) });
      return ussdCon(`Select crop:\n${menu}`);
    }
    if (level === 2) {
      const cropName = data.crops?.[parseInt(inputs[1]) - 1];
      if (!cropName) return ussdEnd("Invalid selection. Try again.");
      const markets = await getMarkets();
      const menu    = markets.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
      await updateSession(sessionId, "predict_market", { ...data, selectedCrop: cropName, markets: markets.map((m) => m.name) });
      return ussdCon(`Select market:\n${menu}`);
    }
    if (level === 3) {
      const marketName = data.markets?.[parseInt(inputs[2]) - 1];
      const cropName   = data.selectedCrop;
      if (!marketName || !cropName) return ussdEnd("Invalid selection. Try again.");
      const result = await getPriceData(cropName, marketName);
      await clearSession(sessionId);
      if (!result) return ussdEnd(`No data for ${cropName} in ${marketName}.`);
      const predText = result.predictedPrice
        ? `Predicted: ZMW ${result.predictedPrice.toFixed(2)}/${result.unit}`
        : "No prediction available yet.";
      return ussdEnd(`${result.crop} - ${result.market}\nCurrent: ZMW ${result.price.toFixed(2)}/${result.unit}\n${predText}\nDial *384*123# for more.`);
    }
  }

  // 3. Set Price Alert
  if (choice === "3") {
    const reg = await prisma.farmerRegistration.findUnique({ where: { phoneNumber } });
    if (!reg) {
      await clearSession(sessionId);
      return ussdEnd("Please register first.\nDial *384*123# and select 4.");
    }
    if (level === 1) {
      const crops = await getCrops();
      const menu  = crops.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      await updateSession(sessionId, "alert_crop", { crops: crops.map((c) => c.name) });
      return ussdCon(`Alert for which crop?\n${menu}`);
    }
    if (level === 2) {
      const cropName = data.crops?.[parseInt(inputs[1]) - 1];
      if (!cropName) return ussdEnd("Invalid selection.");
      const markets = await getMarkets();
      const menu    = markets.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
      await updateSession(sessionId, "alert_market", { ...data, selectedCrop: cropName, markets: markets.map((m) => m.name) });
      return ussdCon(`Select market:\n${menu}`);
    }
    if (level === 3) {
      const marketName = data.markets?.[parseInt(inputs[2]) - 1];
      if (!marketName) return ussdEnd("Invalid selection.");
      await updateSession(sessionId, "alert_price", { ...data, selectedMarket: marketName });
      return ussdCon(`Set alert for ${data.selectedCrop} in ${marketName}.\nEnter target price in ZMW:`);
    }
    if (level === 4) {
      const targetPrice = parseFloat(inputs[3]);
      if (isNaN(targetPrice) || targetPrice <= 0) return ussdEnd("Invalid price. Dial *384*123# to retry.");
      const reg = await prisma.farmerRegistration.findUnique({ where: { phoneNumber } });
      if (!reg?.userId) return ussdEnd("Account not linked. Please log in at agrihub.com first.");
      const [crop, market] = await Promise.all([
        prisma.crop.findFirst({ where: { name: { equals: data.selectedCrop } } }),
        prisma.market.findFirst({ where: { name: { equals: data.selectedMarket } } }),
      ]);
      if (!crop || !market) return ussdEnd("Crop or market not found.");
      await prisma.priceAlert.create({
        data: { userId: reg.userId, cropId: crop.id, marketId: market.id, targetPrice, isActive: true },
      });
      await clearSession(sessionId);
      return ussdEnd(`Alert set! You will be SMS'd when ${data.selectedCrop} in ${data.selectedMarket} reaches ZMW ${targetPrice.toFixed(2)}.`);
    }
  }

  // 4. Register
  if (choice === "4") {
    const existing = await prisma.farmerRegistration.findUnique({ where: { phoneNumber } });
    if (existing) {
      await clearSession(sessionId);
      return ussdEnd(`Already registered as ${existing.fullName ?? "a farmer"}.\nDial *384*123# to check prices.`);
    }
    if (level === 1) {
      await updateSession(sessionId, "register_name", {});
      return ussdCon("Enter your full name:");
    }
    if (level === 2) {
      const fullName = inputs[1]?.trim();
      if (!fullName || fullName.length < 2) return ussdEnd("Invalid name. Dial *384*123# to retry.");
      await prisma.farmerRegistration.create({ data: { phoneNumber, fullName, channel: "ussd" } });
      await sendOrQueueSMS(phoneNumber,
        `Welcome to AgriHub, ${fullName}! You are now registered. ` +
        `Dial *384*123# to check crop prices anytime.`
      );
      await clearSession(sessionId);
      return ussdEnd(`Welcome, ${fullName}!\nRegistration successful.\nAn SMS confirmation has been sent.`);
    }
  }

  await clearSession(sessionId);
  return ussdEnd("Invalid option. Dial *384*123# to start again.");
}