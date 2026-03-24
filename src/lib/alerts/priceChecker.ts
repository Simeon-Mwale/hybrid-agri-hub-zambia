// src/lib/alerts/priceChecker.ts
import { prisma } from '@/lib/prisma';
import { SMSService } from '@/lib/sms/queue';

export class PriceAlertChecker {
  // Check all active alerts against current prices
  static async checkAlerts() {
    // Get all active alerts
    const alerts = await prisma.priceAlert.findMany({
      where: { isActive: true },
      include: {
        user: true,
        crop: true,
        market: true,
      },
    });

    for (const alert of alerts) {
      await this.checkSingleAlert(alert);
    }
  }

  private static async checkSingleAlert(alert: any) {
    // Get the latest price for this crop and market
    const latestPrice = await prisma.dailyPrice.findFirst({
      where: {
        cropId: alert.cropId,
        marketId: alert.marketId,
      },
      orderBy: { priceDate: 'desc' },
    });

    if (!latestPrice) return;

    // Check if price meets or exceeds target
    if (latestPrice.price >= alert.targetPrice) {
      await this.triggerAlert(alert, latestPrice);
    }
  }

  private static async triggerAlert(alert: any, price: any) {
    const message = this.formatAlertMessage(alert, price);
    
    // Queue SMS for sending
    await SMSService.queueSMS(alert.user.phone, message);

    // Deactivate alert if it's a one-time alert (optional)
    // await prisma.priceAlert.update({
    //   where: { id: alert.id },
    //   data: { isActive: false },
    // });
  }

  private static formatAlertMessage(alert: any, price: any): string {
    return `🔔 Price Alert: ${alert.crop.name} at ${alert.market.name} has reached ZMW ${price.price.toFixed(2)} (target: ZMW ${alert.targetPrice.toFixed(2)}). Date: ${new Date(price.priceDate).toLocaleDateString()}`;
  }
}