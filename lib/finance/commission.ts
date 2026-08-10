import { Prisma, type LedgerEntry } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient;

export const BUSINESS_COMMISSION_RATE = new Prisma.Decimal("5");
export const CREATOR_COMMISSION_RATE = new Prisma.Decimal("15");

export const CAMPAIGN_FEE_PREFIX = "CAMPAIGN_FEE_";
export const WITHDRAWAL_FEE_PREFIX = "WITHDRAWAL_FEE_";

export type CommissionConfig = {
  businessRate: Prisma.Decimal;
  creatorRate: Prisma.Decimal;
};

export function getCommissionConfig(): CommissionConfig {
  return {
    businessRate: BUSINESS_COMMISSION_RATE,
    creatorRate: CREATOR_COMMISSION_RATE,
  };
}

export function calculateBusinessCommission(
  billableAmount: Prisma.Decimal,
): Prisma.Decimal {
  if (billableAmount.lte(0)) return new Prisma.Decimal(0);
  return billableAmount
    .mul(BUSINESS_COMMISSION_RATE)
    .div(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateCreatorCommission(
  grossAmount: Prisma.Decimal,
): Prisma.Decimal {
  if (grossAmount.lte(0)) return new Prisma.Decimal(0);
  return grossAmount
    .mul(CREATOR_COMMISSION_RATE)
    .div(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateCreatorNetAmount(
  grossAmount: Prisma.Decimal,
): Prisma.Decimal {
  return grossAmount.sub(calculateCreatorCommission(grossAmount));
}

export type WithdrawalSettlement = {
  grossAmount: Prisma.Decimal;
  commissionRate: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
};

export function calculateWithdrawalSettlement(
  grossAmount: Prisma.Decimal,
): WithdrawalSettlement {
  const commissionAmount = calculateCreatorCommission(grossAmount);
  return {
    grossAmount,
    commissionRate: CREATOR_COMMISSION_RATE,
    commissionAmount,
    netAmount: grossAmount.sub(commissionAmount),
  };
}

export async function setWithdrawalFeeLedger(
  db: Db,
  withdrawal: { id: string; userId: string; amount: Prisma.Decimal },
  status: "PENDING" | "AVAILABLE" | "REVERSED",
) {
  const referenceId = `${WITHDRAWAL_FEE_PREFIX}${withdrawal.id}`;
  const settlement = calculateWithdrawalSettlement(withdrawal.amount);

  const existing = await db.ledgerEntry.findFirst({
    where: { referenceId },
  });

  if (existing) {
    return db.ledgerEntry.update({
      where: { id: existing.id },
      data: { status },
    });
  }

  return db.ledgerEntry.create({
    data: {
      userId: withdrawal.userId,
      type: "PLATFORM_FEE",
      status,
      amount: settlement.commissionAmount,
      currency: "IRR",
      description: "کارمزد برداشت خالق محتوا",
      referenceId,
    },
  });
}

export async function settleCampaign(
  db: Db,
  campaignId: string,
): Promise<LedgerEntry | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE
  `;
  if (rows.length === 0) return null;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
      spentAmount: true,
      settledAt: true,
      business: { select: { userId: true } },
    },
  });

  if (!campaign || campaign.status !== "COMPLETED") return null;
  if (campaign.settledAt) return null;

  const referenceId = `${CAMPAIGN_FEE_PREFIX}${campaign.id}`;
  const existing = await db.ledgerEntry.findFirst({
    where: { referenceId },
  });
  if (existing) return existing;

  const fee = calculateBusinessCommission(campaign.spentAmount);
  const settledAt = new Date();

  await db.campaign.update({
    where: { id: campaignId },
    data: { settledAt },
  });

  if (fee.lte(0)) return null;

  return db.ledgerEntry.create({
    data: {
      userId: campaign.business.userId,
      campaignId,
      type: "PLATFORM_FEE",
      status: "AVAILABLE",
      amount: fee,
      currency: "IRR",
      description: "کارمزد پلتفرم برای تسویه کمپین",
      referenceId,
      createdAt: settledAt,
    },
  });
}

export async function maybeAutoCloseCampaign(
  db: Db,
  campaignId: string,
): Promise<{ completed: boolean; reason: string | null }> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE
  `;
  if (rows.length === 0) return { completed: false, reason: null };

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.status !== "ACTIVE") {
    return { completed: false, reason: null };
  }

  let reason: string | null = null;

  if (campaign.spentAmount.gte(campaign.budget)) {
    reason = "BUDGET_EXHAUSTED";
  } else if (campaign.endAt && campaign.endAt <= new Date()) {
    reason = "END_REACHED";
  } else if (campaign.conversionGoal && campaign.conversionGoal > 0) {
    const approved = await db.conversion.count({
      where: { campaignId, status: "APPROVED" },
    });
    if (approved >= campaign.conversionGoal) {
      reason = "GOAL_REACHED";
    }
  }

  if (!reason) return { completed: false, reason: null };

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: "COMPLETED",
      reservedAmount: campaign.spentAmount,
    },
  });

  await settleCampaign(db, campaignId);

  return { completed: true, reason };
}

export type AutoCloseResult = {
  campaignId: string;
  reason: string;
};

export async function runAutoCloseSweep(): Promise<{
  closed: AutoCloseResult[];
  settled: string[];
}> {
  const closed: AutoCloseResult[] = [];
  const settled: string[] = [];

  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  for (const campaign of activeCampaigns) {
    const result = await prisma.$transaction((tx) =>
      maybeAutoCloseCampaign(tx, campaign.id),
    );
    if (result.completed) {
      closed.push({ campaignId: campaign.id, reason: result.reason ?? "AUTO" });
    }
  }

  const unsettled = await prisma.campaign.findMany({
    where: { status: "COMPLETED", settledAt: null },
    select: { id: true },
  });

  for (const campaign of unsettled) {
    await prisma.$transaction((tx) => settleCampaign(tx, campaign.id));
    settled.push(campaign.id);
  }

  return { closed, settled };
}
