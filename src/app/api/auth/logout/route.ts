import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" });
  res.cookies.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0, // remove cookie
  });
  return res;
}
