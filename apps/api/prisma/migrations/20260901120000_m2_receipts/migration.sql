-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FieldSource" AS ENUM ('OCR', 'AI', 'USER');

-- CreateEnum
CREATE TYPE "EntryMode" AS ENUM ('SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('ITEM', 'DISCOUNT', 'DEPOSIT', 'DEPOSIT_RETURN', 'FEE');

-- CreateEnum
CREATE TYPE "ItemUnit" AS ENUM ('PCS', 'KG', 'G', 'L', 'ML', 'M');

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "merchantId" UUID,
    "purchasedAt" DATE,
    "purchasedTime" TEXT,
    "currency" CHAR(3) NOT NULL,
    "subtotalMinor" INTEGER,
    "taxTotalMinor" INTEGER,
    "discountTotalMinor" INTEGER,
    "totalMinor" INTEGER,
    "receiptNumber" TEXT,
    "note" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "imageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "fileSha256" CHAR(64) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "confidence" "ConfidenceLevel",
    "fieldSources" JSONB NOT NULL DEFAULT '{}',
    "entryMode" "EntryMode" NOT NULL DEFAULT 'SCAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptItem" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "categoryId" UUID,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rawText" TEXT,
    "lineType" "LineType" NOT NULL DEFAULT 'ITEM',
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit" "ItemUnit" NOT NULL DEFAULT 'PCS',
    "unitPriceMinor" INTEGER,
    "totalPriceMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER,
    "confidence" "ConfidenceLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'WAITING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "extractorKind" TEXT NOT NULL,
    "providerModel" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "costMicros" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawResultKey" TEXT,
    "rawResultExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseBody" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Receipt_userId_purchasedAt_idx" ON "Receipt"("userId", "purchasedAt" DESC);

-- CreateIndex
CREATE INDEX "Receipt_userId_status_purchasedAt_idx" ON "Receipt"("userId", "status", "purchasedAt");

-- CreateIndex
CREATE INDEX "Receipt_userId_processingStatus_idx" ON "Receipt"("userId", "processingStatus");

-- CreateIndex
CREATE INDEX "Receipt_merchantId_idx" ON "Receipt"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_user_file_active_idx" ON "Receipt"("userId", "fileSha256") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "ReceiptItem_receiptId_position_idx" ON "ReceiptItem"("receiptId", "position");

-- CreateIndex
CREATE INDEX "ReceiptItem_categoryId_idx" ON "ReceiptItem"("categoryId");

-- CreateIndex
CREATE INDEX "ProcessingJob_receiptId_createdAt_idx" ON "ProcessingJob"("receiptId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProcessingJob_status_createdAt_idx" ON "ProcessingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
