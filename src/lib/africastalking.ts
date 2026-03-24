// src/lib/africastalking.ts
// Africa's Talking SDK wrapper

const API_KEY  = process.env.AT_API_KEY  || "";
const USERNAME = process.env.AT_USERNAME || "sandbox";
const BASE_URL = USERNAME === "sandbox"
  ? "https://api.sandbox.africastalking.com"
  : "https://api.africastalking.com";

// ── Send SMS ──────────────────────────────────────────────────────────────────

export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/version1/messaging`, {
      method: "POST",
      headers: {
        Accept:         "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey:         API_KEY,
      },
      body: new URLSearchParams({
        username: USERNAME,
        to,
        message,
        // from: "AgriHub", // uncomment when you have a registered sender ID
      }),
    });

    const data = await res.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    return recipient?.status === "Success";
  } catch (err) {
    console.error("Africa's Talking SMS error:", err);
    return false;
  }
}

// ── Format USSD response ──────────────────────────────────────────────────────
// CON = continue session (show menu again)
// END = close session (final message)

export function ussdCon(text: string) {
  return { response: `CON ${text}`, type: "CON" };
}

export function ussdEnd(text: string) {
  return { response: `END ${text}`, type: "END" };
}