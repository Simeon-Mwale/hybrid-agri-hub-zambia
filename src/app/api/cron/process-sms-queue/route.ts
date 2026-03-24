import { NextRequest, NextResponse } from "next/server";
import { processSmsQueue } from "@/lib/sms-queue";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processSmsQueue();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("SMS queue cron error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}