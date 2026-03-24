import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "supersecret"
);

async function getAdminPayload() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as { id: string; role: string };
    if (p.role !== "ADMIN") return null;
    return p;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "5", 10);

    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }

    const prices = await prisma.dailyPrice.findMany({
      orderBy: { priceDate: "desc" },
      take: limit,
      include: { crop: true, market: true },
    });

    const data = prices.map((p) => ({
      id:        p.id,
      crop:      p.crop.name,
      market:    p.market.name,
      price:     p.price,
      date:      p.priceDate.toISOString().slice(0, 10),
      createdBy: p.createdBy ?? "Unknown",
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/prices error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAdminPayload();

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { cropId, marketId, price, priceDate } = body;

    if (!cropId || !marketId || !price || !priceDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newPrice = await prisma.dailyPrice.create({
      data: {
        cropId,
        marketId,
        price:     Number(price),
        priceDate: new Date(priceDate),
        createdBy: payload.id,
      },
      include: { crop: true, market: true },
    });

    // Log activity — fire and forget
    prisma.activity.create({
      data: {
        type:        "PRICE_ADDED",
        description: `Added price ZMW ${price} for ${newPrice.crop.name} at ${newPrice.market.name}`,
        userId:      payload.id,
        status:      "SUCCESS",
        metadata:    JSON.stringify({
          priceId: newPrice.id,
          cropId,
          marketId,
          price,
        }),
      },
    }).catch((e) => console.error("Failed to log activity:", e));

    return NextResponse.json({
      success: true,
      data: {
        id:     newPrice.id,
        crop:   newPrice.crop.name,
        market: newPrice.market.name,
        price:  newPrice.price,
        date:   newPrice.priceDate.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    console.error("POST /api/admin/prices error:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
}