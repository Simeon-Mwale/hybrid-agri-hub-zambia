import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "supersecret"
);

async function getTokenPayload(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: string; role: string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("auth_token")?.value;
  const payload = token ? await getTokenPayload(token) : null;

  // ✅ Redirect logged-in users away from auth pages
  if (pathname === "/login" || pathname === "/register" || pathname === "/") {
    if (payload) {
      const dest = payload.role === "ADMIN"
        ? "/dashboard/admin"
        : "/dashboard/farmer";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    if (!payload) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/admin")) {
      if (payload.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard/farmer", request.url));
      }
    }

    if (pathname.startsWith("/dashboard/farmer")) {
      if (payload.role !== "FARMER" && payload.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/admin/:path*"],
};