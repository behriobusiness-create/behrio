-- AlterTable
-- Behrio now supports CPM exclusively. rewardPerThousand is the CPM rate
-- (price per 1,000 verified impressions) and is renamed to `cpm` for clarity.
ALTER TABLE "Campaign" RENAME COLUMN "rewardPerThousand" TO "cpm";

-- Track total verified impressions approved for payout per campaign.
ALTER TABLE "Campaign" ADD COLUMN "verifiedImpressions" INTEGER NOT NULL DEFAULT 0;

-- Separate reported (claimed) from verified impressions on creator reports.
ALTER TABLE "CampaignReport" ADD COLUMN "verifiedImpressions" INTEGER;
