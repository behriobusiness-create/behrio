import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import {
  calculateWithdrawalSettlement,
  setWithdrawalFeeLedger,
} from "@/lib/finance/commission";

type Db = Prisma.TransactionClient;

const WITHDRAWAL_ACTIVE_STATUSES = [
  "REQUESTED",
  "PROCESSING",
  "COMPLETED",
] as const;

function toDecimal(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(String(value));
}

export async function getAvailableBalance(
  db: Db,
  userId: string
): Promise<Prisma.Decimal> {
  const [earnings, withdrawals] = await Promise.all([
    db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        type: "CREATOR_EARNING",
        status: "AVAILABLE",
      },
    }),
    db.withdrawal.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        status: { in: [...WITHDRAWAL_ACTIVE_STATUSES] },
      },
    }),
  ]);

  return toDecimal(earnings._sum.amount).sub(
    toDecimal(withdrawals._sum.amount)
  );
}

export type RequestWithdrawalInput = {
  userId: string;
  amount: Prisma.Decimal;
  iban?: string | null;
  bankName?: string | null;
};

export async function requestWithdrawal(input: RequestWithdrawalInput) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!input.amount.gt(0)) {
      throw new Error("INVALID_AMOUNT");
    }

    const balance = await getAvailableBalance(tx, input.userId);

    if (input.amount.gt(balance)) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    const settlement = calculateWithdrawalSettlement(input.amount);

    const withdrawal = await tx.withdrawal.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        grossAmount: settlement.grossAmount,
        commissionRate: settlement.commissionRate,
        commissionAmount: settlement.commissionAmount,
        netAmount: settlement.netAmount,
        currency: "IRR",
        iban: input.iban?.trim() || null,
        bankName: input.bankName?.trim() || null,
        status: "REQUESTED",
      },
    });

    await setWithdrawalFeeLedger(tx, withdrawal, "PENDING");

    return withdrawal;
  });
}

export function parseAmountInput(raw: unknown): Prisma.Decimal | null {
  const value = typeof raw === "string" ? raw.trim() : String(raw);

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  return new Prisma.Decimal(value);
}

const RESERVED_CAMPAIGN_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "PAUSED",
] as const;

export type BusinessWallet = {
  funded: Prisma.Decimal;
  reserved: Prisma.Decimal;
  spent: Prisma.Decimal;
  available: Prisma.Decimal;
};

export async function getBusinessWallet(
  db: Db,
  userId: string
): Promise<BusinessWallet> {
  const business = await db.businessProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!business) {
    return {
      funded: new Prisma.Decimal(0),
      reserved: new Prisma.Decimal(0),
      spent: new Prisma.Decimal(0),
      available: new Prisma.Decimal(0),
    };
  }

  const [fundedAgg, reservedAgg, spentAgg] = await Promise.all([
    db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        type: "CAMPAIGN_FUNDING",
        status: { in: ["AVAILABLE", "PROCESSING"] },
      },
    }),
    db.campaign.aggregate({
      _sum: { reservedAmount: true },
      where: {
        businessId: business.id,
        status: { in: [...RESERVED_CAMPAIGN_STATUSES] },
      },
    }),
    db.campaign.aggregate({
      _sum: { spentAmount: true },
      where: { businessId: business.id },
    }),
  ]);

  const funded = toDecimal(fundedAgg._sum.amount);
  const reserved = toDecimal(reservedAgg._sum.reservedAmount);
  const spent = toDecimal(spentAgg._sum.spentAmount);

  return {
    funded,
    reserved,
    spent,
    available: funded.sub(reserved),
  };
}

export async function settleReservedIfTerminal(
  db: Db,
  campaignId: string
): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true, spentAmount: true },
  });

  if (!campaign) return;

  if (campaign.status === "CANCELLED" || campaign.status === "COMPLETED") {
    await db.campaign.update({
      where: { id: campaignId },
      data: { reservedAmount: campaign.spentAmount },
    });
  }
}
