import { Prisma } from "@/app/generated/prisma/client";

type Db = Prisma.TransactionClient;

export type CampaignCapacity = {
  id: string;
  status: string;
  budget: Prisma.Decimal;
  spentAmount: Prisma.Decimal;
  startAt: Date | null;
  endAt: Date | null;
  accessType: string;
};

export function campaignHasCapacity(campaign: CampaignCapacity): {
  ok: boolean;
  reason: string | null;
} {
  if (campaign.status !== "ACTIVE") {
    return { ok: false, reason: "این کمپین فعال نیست." };
  }

  if (campaign.endAt && campaign.endAt.getTime() <= Date.now()) {
    return { ok: false, reason: "زمان این کمپین به پایان رسیده است." };
  }

  if (campaign.spentAmount.gte(campaign.budget)) {
    return { ok: false, reason: "بودجه این کمپین به پایان رسیده است." };
  }

  return { ok: true, reason: null };
}

export async function lockCampaignForCapacityCheck(
  db: Db,
  campaignId: string
): Promise<CampaignCapacity | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE
  `;
  if (rows.length === 0) return null;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
      budget: true,
      spentAmount: true,
      startAt: true,
      endAt: true,
      accessType: true,
    },
  });

  return campaign as CampaignCapacity | null;
}