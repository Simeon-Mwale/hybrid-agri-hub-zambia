 // src/lib/smsProcessor.ts
import { prisma } from "./prisma";

export async function processPendingSms() {
  const pendingSms = await prisma.smsQueue.findMany({ where: { status: "PENDING" } });

  for (const sms of pendingSms) {
    try {
      await fetch("http://localhost:3000/api/farmer/sms", {
        method: "POST",
        body: JSON.stringify({ phone: sms.phone, message: sms.message }),
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      await prisma.smsQueue.update({ where: { id: sms.id }, data: { attempts: sms.attempts + 1 } });
    }
  }
}

