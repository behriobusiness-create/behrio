-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED', 'VERIFICATION_PENDING', 'VERIFIED', 'FAILED', 'DISABLED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "clickRewardPerGroup" INTEGER DEFAULT 1,
ADD COLUMN     "commissionPercent" DECIMAL(5,2),
ADD COLUMN     "conversionGoal" INTEGER,
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Click" ADD COLUMN     "clickId" TEXT NOT NULL,
ADD COLUMN     "creditedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversion" ADD COLUMN     "clickId" TEXT,
ADD COLUMN     "screenshot" TEXT,
ADD COLUMN     "source" TEXT DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "commissionAmount" DECIMAL(18,2),
ADD COLUMN     "commissionRate" DECIMAL(5,2),
ADD COLUMN     "grossAmount" DECIMAL(18,2),
ADD COLUMN     "netAmount" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "EmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignIntegration" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "verifiedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "testClickId" TEXT,
    "verifiedBy" TEXT,
    "verificationMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "campaignId" TEXT,
    "apiKeyId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "errorCode" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOtp_email_idx" ON "EmailOtp"("email");

-- CreateIndex
CREATE INDEX "EmailOtp_expiresAt_idx" ON "EmailOtp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessApiKey_keyHash_key" ON "BusinessApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "BusinessApiKey_userId_idx" ON "BusinessApiKey"("userId");

-- CreateIndex
CREATE INDEX "BusinessApiKey_revokedAt_idx" ON "BusinessApiKey"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignIntegration_campaignId_key" ON "CampaignIntegration"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignIntegration_testClickId_key" ON "CampaignIntegration"("testClickId");

-- CreateIndex
CREATE INDEX "CampaignIntegration_userId_idx" ON "CampaignIntegration"("userId");

-- CreateIndex
CREATE INDEX "CampaignIntegration_status_idx" ON "CampaignIntegration"("status");

-- CreateIndex
CREATE INDEX "CampaignIntegration_campaignId_idx" ON "CampaignIntegration"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRequestLog_requestId_key" ON "ApiRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_userId_idx" ON "ApiRequestLog"("userId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_campaignId_idx" ON "ApiRequestLog"("campaignId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_apiKeyId_idx" ON "ApiRequestLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_createdAt_idx" ON "ApiRequestLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Click_clickId_key" ON "Click"("clickId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_clickId_key" ON "Conversion"("clickId");

-- CreateIndex
CREATE INDEX "Conversion_source_idx" ON "Conversion"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_campaignId_externalOrderId_key" ON "Conversion"("campaignId", "externalOrderId");

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "Click"("clickId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessApiKey" ADD CONSTRAINT "BusinessApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIntegration" ADD CONSTRAINT "CampaignIntegration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIntegration" ADD CONSTRAINT "CampaignIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIntegration" ADD CONSTRAINT "CampaignIntegration_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "BusinessApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "BusinessApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

