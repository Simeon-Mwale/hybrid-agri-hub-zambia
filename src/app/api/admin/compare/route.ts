import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const crops = searchParams.getAll("crop"); // ?crop=Maize&crop=Rice
  const markets = searchParams.getAll("market"); // ?market=Lusaka&market=Ndola

  if (!crops.length || !markets.length) {
    return NextResponse.json(
      { error: "Provide at least one crop and market" },
      { status: 400 }
    );
  }

  const result = [];

  for (const cropName of crops) {
    const crop = await prisma.crop.findUnique({
      where: { name: cropName },
    });

    if (!crop) continue;

    for (const marketName of markets) {
      const market = await prisma.market.findUnique({
        where: { name: marketName },
      });

      if (!market) continue;

      const prices = await prisma.dailyPrice.findMany({
        where: {
          cropId: crop.id,
          marketId: market.id,
        },
        orderBy: { priceDate: "asc" },
        take: 30,
      });

      result.push({
        crop: crop.name,
        market: market.name,
        labels: prices.map(p =>
          p.priceDate.toISOString().slice(0, 10)
        ),
        data: prices.map(p => p.price),
      });
    }
  }

  return NextResponse.json(result);
}