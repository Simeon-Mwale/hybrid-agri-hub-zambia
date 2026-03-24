// src/lib/sms/queue.ts
import { prisma } from '@/lib/prisma';

export class SMSService {
  // Add message to queue
  static async queueSMS(phone: string, message: string) {
    return await prisma.smsQueue.create({
      data: {
        phone,
        message,
        status: 'PENDING',
        attempts: 0,
      },
    });
  }

  // Process pending messages (call this from a cron job)
  static async processQueue() {
    const pendingMessages = await prisma.smsQueue.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: 3 }, // Max 3 attempts
      },
      orderBy: { createdAt: 'asc' },
      take: 10, // Process in batches
    });

    for (const message of pendingMessages) {
      await this.sendSMS(message);
    }
  }

  private static async sendSMS(queueItem: any) {
    try {
      // TODO: Integrate with your SMS provider (Twilio, Africa's Talking, etc.)
      console.log(`Sending SMS to ${queueItem.phone}: ${queueItem.message}`);
      
      // Simulate successful send
      await prisma.smsQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'SENT',
          processedAt: new Date(),
          attempts: { increment: 1 },
          response: 'Message sent successfully',
        },
      });
    } catch (error) {
      // Update attempt count
      await prisma.smsQueue.update({
        where: { id: queueItem.id },
        data: {
          attempts: { increment: 1 },
          status: queueItem.attempts + 1 >= 3 ? 'FAILED' : 'PENDING',
          response: error.message,
        },
      });
    }
  }
}