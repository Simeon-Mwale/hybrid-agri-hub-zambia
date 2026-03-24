// src/lib/auth-helper.ts
// Shared helper — import this in every route that needs the current user id

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value; // ✅ matches login route
    if (!token) return null;

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecret"
    ) as { id: string; role: string };

    return payload.id ?? null;
  } catch {
    // Token missing, expired, or invalid
    return null;
  }
}