/*
  Warnings:

  - You are about to drop the column `attempts` on the `SmsQueue` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `SmsQueue` table. All the data in the column will be lost.
  - You are about to drop the column `processedAt` on the `SmsQueue` table. All the data in the column will be lost.
  - Added the required column `phoneNumber` to the `SmsQueue` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "UssdSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'main',
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UssdRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FarmerRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "fullName" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FarmerRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SmsQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
);
INSERT INTO "new_SmsQueue" ("createdAt", "id", "message", "response", "status", "phoneNumber") SELECT "createdAt", "id", "message", "response", "status", COALESCE("phone", '') FROM "SmsQueue";
DROP TABLE "SmsQueue";
ALTER TABLE "new_SmsQueue" RENAME TO "SmsQueue";
CREATE INDEX "SmsQueue_status_createdAt_idx" ON "SmsQueue"("status", "createdAt");
CREATE INDEX "SmsQueue_phoneNumber_idx" ON "SmsQueue"("phoneNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UssdSession_sessionId_key" ON "UssdSession"("sessionId");

-- CreateIndex
CREATE INDEX "UssdRequest_phoneNumber_idx" ON "UssdRequest"("phoneNumber");

-- CreateIndex
CREATE INDEX "UssdRequest_createdAt_idx" ON "UssdRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerRegistration_phoneNumber_key" ON "FarmerRegistration"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerRegistration_userId_key" ON "FarmerRegistration"("userId");
