// src/app/api/farmer/settings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-helper";
import bcrypt from "bcrypt";

// ── GET /api/farmer/settings ──────────────────────────────────────────────────
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        priceAlerts: {
          where: { isActive: true },
          // ✅ include crop and market so the UI can show their names
          include: {
            crop: { select: { name: true, unit: true } },
            market: { select: { name: true, province: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/farmer/settings ────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, phone, currentPassword, newPassword } = body;

    const updateData: any = {};

    if (fullName !== undefined) {
      if (!fullName.trim()) {
        return NextResponse.json(
          { success: false, error: "Full name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim() || null;
    }

    if (newPassword !== undefined) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Current password is required" },
          { status: 400 }
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: "New password must be at least 8 characters" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });
      if (!user) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, fullName: true, email: true, phone: true, role: true },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Settings saved successfully",
    });
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("phone")) {
      return NextResponse.json(
        { success: false, error: "That phone number is already in use" },
        { status: 400 }
      );
    }
    console.error("Settings PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}