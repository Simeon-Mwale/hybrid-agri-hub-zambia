/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber,message]` on the table `SmsQueue` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "DailyPrice_cropId_marketId_priceDate_idx" ON "DailyPrice"("cropId", "marketId", "priceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SmsQueue_phoneNumber_message_key" ON "SmsQueue"("phoneNumber", "message");
