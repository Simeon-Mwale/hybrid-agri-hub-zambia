import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { fullName, email, password, phone } = await req.json();

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Full name, email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: "FARMER",
      },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "8h" }
    );

    // ✅ Same ngrok-aware cookie logic
    const origin = req.headers.get("origin") ?? "";
    const host = req.headers.get("host") ?? "";
    const isHttps = origin.startsWith("https://") || host.includes("ngrok");
    const isProd = process.env.NODE_ENV === "production";
    const useSecure = isProd || isHttps;

    const response = NextResponse.json({
      message: "Registration successful",
      role: user.role,
      email: user.email,
    });

    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: 8 * 60 * 60,
      sameSite: useSecure ? "none" : "lax",
      secure: useSecure,
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}