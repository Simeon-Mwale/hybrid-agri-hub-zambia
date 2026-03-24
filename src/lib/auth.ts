// src/lib/auth.ts
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "supersecret"
);

export interface TokenPayload {
  id: string;
  role: string;
  email?: string;
}

/**
 * Verifies the custom auth_token cookie and returns its payload.
 * Use this in ALL API route handlers instead of getServerSession().
 */
export async function getAuthPayload(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies(); // ✅ Next.js 15: cookies() is now async
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user's id, or null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  const payload = await getAuthPayload();
  return payload?.id ?? null;
}