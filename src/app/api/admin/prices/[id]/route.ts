// src/app/api/admin/prices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

// ── Admin guard helper ────────────────────────────────────────────────────────
async function requireAdmin() {
  const payload = await getAuthPayload();
  if (!payload)              return { error: "Unauthorized", status: 401 } as const;
  if (payload.role !== "ADMIN") return { error: "Forbidden",    status: 403 } as const;
  return { payload };
}

// ── GET /api/admin/prices/[id] ────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const price = await prisma.dailyPrice.findUnique({
      where: { id: params.id },
      include: {
        crop:   { select: { id: true, name: true, category: true } },
        market: { select: { id: true, name: true, province: true } },
      },
    });

    if (!price) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    return NextResponse.json(price);
  } catch (error) {
    console.error("GET /api/admin/prices/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
  }
}

// ── PUT /api/admin/prices/[id] ────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body                = await request.json();
    const { price, priceDate } = body;

    const existingPrice = await prisma.dailyPrice.findUnique({
      where:   { id: params.id },
      include: { crop: { select: { name: true } }, market: { select: { name: true } } },
    });

    if (!existingPrice) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    const updatedPrice = await prisma.dailyPrice.update({
      where: { id: params.id },
      data: {
        price:     price     ? parseFloat(price)    : undefined,
        priceDate: priceDate ? new Date(priceDate)  : undefined,
      },
      include: {
        crop:   { select: { name: true } },
        market: { select: { name: true } },
      },
    });

    // Log activity (non-blocking)
    prisma.activity.create({
      data: {
        type:        "PRICE_UPDATED",
        description: `Updated price for ${updatedPrice.crop.name} at ${updatedPrice.market.name}`,
        userId:      auth.payload.id,
        status:      "SUCCESS",
        metadata:    JSON.stringify({ priceId: updatedPrice.id, price, priceDate }),
      },
    }).catch((e) => console.error("Failed to log activity:", e));

    return NextResponse.json(updatedPrice);
  } catch (error) {
    console.error("PUT /api/admin/prices/[id] error:", error);
    return NextResponse.json({ error: "Failed to update price" }, { status: 500 });
  }
}

// ── DELETE /api/admin/prices/[id] ─────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const price = await prisma.dailyPrice.findUnique({
      where:   { id: params.id },
      include: { crop: { select: { name: true } }, market: { select: { name: true } } },
    });

    if (!price) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    await prisma.dailyPrice.delete({ where: { id: params.id } });

    // Log activity (non-blocking)
    prisma.activity.create({
      data: {
        type:        "PRICE_DELETED",
        description: `Deleted price for ${price.crop.name} at ${price.market.name}`,
        userId:      auth.payload.id,
        status:      "SUCCESS",
        metadata:    JSON.stringify({ priceId: params.id }),
      },
    }).catch((e) => console.error("Failed to log activity:", e));

    return NextResponse.json({ message: "Price deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/admin/prices/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete price" }, { status: 500 });
  }
}