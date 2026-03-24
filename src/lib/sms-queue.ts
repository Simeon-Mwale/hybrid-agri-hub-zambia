import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/africastalking";

export async function queueSMS(phoneNumber: string, message: string) {
  return prisma.smsQueue.create({
    data: { phoneNumber, message, status: "pending" },
  });
}

export async function sendOrQueueSMS(phoneNumber: string, message: string) {
  const sent = await sendSMS(phoneNumber, message);
  if (!sent) {
    await queueSMS(phoneNumber, message);
    console.warn(`SMS queued for ${phoneNumber}`);
  }
  return sent;
}

export async function processSmsQueue() {
  const MAX_RETRIES = 3;

  const pending = await prisma.smsQueue.findMany({
    where:   { status: "pending", retries: { lt: MAX_RETRIES } },
    orderBy: { createdAt: "asc" },
    take:    50,
  });

  const results = await Promise.allSettled(
    pending.map(async (item) => {
      const sent = await sendSMS(item.phoneNumber, item.message);
      if (sent) {
        await prisma.smsQueue.update({
          where: { id: item.id },
          data:  { status: "sent", sentAt: new Date() },
        });
      } else {
        const newRetries = item.retries + 1;
        await prisma.smsQueue.update({
          where: { id: item.id },
          data:  {
            retries: newRetries,
            status:  newRetries >= MAX_RETRIES ? "failed" : "pending",
            error:   "AT delivery failed",
          },
        });
      }
      return { id: item.id, sent };
    })
  );

  const sent   = results.filter((r) => r.status === "fulfilled" && (r as any).value.sent).length;
  const failed = results.length - sent;
  return { processed: results.length, sent, failed };
}