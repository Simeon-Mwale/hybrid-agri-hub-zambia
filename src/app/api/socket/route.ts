import { NextResponse } from "next/server";
import { initSocket } from "@/lib/socket";
import { startLivePrices } from "@/lib/livePriceEngine";

let started = false;

export async function GET(req: Request) {
  const res = NextResponse.json({ message: "Socket running" });

  const server: any = (res as any).socket?.server;

  if (server && !started) {
    initSocket(server);
    startLivePrices();
    started = true;
  }

  return res;
}