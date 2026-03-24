-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FARMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT '50kg bag',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "priceDate" DATETIME NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyPrice_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyPrice_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "predictedPrice" REAL NOT NULL,
    "basedOnDays" INTEGER NOT NULL,
    "predictionDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Prediction_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "targetPrice" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriceAlert_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriceAlert_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_name_key" ON "Crop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");

-- CreateIndex
CREATE INDEX "DailyPrice_priceDate_idx" ON "DailyPrice"("priceDate");

-- CreateIndex
CREATE INDEX "DailyPrice_cropId_priceDate_idx" ON "DailyPrice"("cropId", "priceDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPrice_cropId_marketId_priceDate_key" ON "DailyPrice"("cropId", "marketId", "priceDate");

-- CreateIndex
CREATE INDEX "SmsQueue_status_createdAt_idx" ON "SmsQueue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmsQueue_phone_idx" ON "SmsQueue"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_userId_cropId_marketId_key" ON "PriceAlert"("userId", "cropId", "marketId");
