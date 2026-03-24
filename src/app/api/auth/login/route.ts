import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact support." },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "8h" }
    );

    // ✅ Check if request is coming via HTTPS (ngrok or production)
    const origin = req.headers.get("origin") ?? "";
    const host = req.headers.get("host") ?? "";
    const isHttps = origin.startsWith("https://") || host.includes("ngrok");
    const isProd = process.env.NODE_ENV === "production";
    const useSecure = isProd || isHttps;

    const response = NextResponse.json({
      email: user.email,
      role: user.role,
      name: user.fullName,
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
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}