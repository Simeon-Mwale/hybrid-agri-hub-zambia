import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload: any = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ id: user.id, role: user.role, fullName: user.fullName });
}
