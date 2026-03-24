/*
  Warnings:

  - A unique constraint covering the columns `[cropId,marketId,predictionDate]` on the table `Prediction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_cropId_marketId_predictionDate_key" ON "Prediction"("cropId", "marketId", "predictionDate");
