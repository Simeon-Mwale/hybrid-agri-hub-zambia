// src/app/api/ussd/route.ts
// Africa's Talking posts to this endpoint on every USSD interaction.
// Set this URL in your AT dashboard: https://yourdomain.com/api/ussd

import { NextRequest, NextResponse } from "next/server";
import { handleUSSD } from "@/lib/ussd-handler";

export async function POST(request: NextRequest) {
  try {
    // AT sends form-encoded data
    const body        = await request.text();
    const params      = new URLSearchParams(body);

    const sessionId   = params.get("sessionId")   || "";
    const serviceCode = params.get("serviceCode") || "";
    const phoneNumber = params.get("phoneNumber") || "";
    const text        = params.get("text")        || "";

    if (!sessionId || !phoneNumber) {
      return new NextResponse("END Invalid request parameters.", { status: 400 });
    }

    const result = await handleUSSD({ sessionId, phoneNumber, text, serviceCode });

    // AT expects a plain text response starting with CON or END
    return new NextResponse(result.response, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });

  } catch (error) {
    console.error("USSD handler error:", error);
    // Always return END on error so the session doesn't hang
    return new NextResponse("END Service temporarily unavailable. Please try again shortly.", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// AT also sends GET for session keep-alive checks
export async function GET() {
  return new NextResponse("AgriHub USSD Service OK", { status: 200 });
}