import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  CAMPAIGN_FEE_PREFIX,
  WITHDRAWAL_FEE_PREFIX,
  getCommissionConfig,
} from "@/lib/finance/commission";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز." },
        { status: 403 }
      );
    }

    const baseWhere = {
      type: "PLATFORM_FEE" as const,
    };

    const [campaignFeeAgg, withdrawalFeeAgg, pendingAgg, reversedAgg] =
      await Promise.all([
        prisma.ledgerEntry.aggregate({
          _sum: { amount: true },
          _count: { _all: true },
          where: {
            ...baseWhere,
            status: "AVAILABLE",
            referenceId: { startsWith: CAMPAIGN_FEE_PREFIX },
          },
        }),
        prisma.ledgerEntry.aggregate({
          _sum: { amount: true },
          _count: { _all: true },
          where: {
            ...baseWhere,
            status: "AVAILABLE",
            referenceId: { startsWith: WITHDRAWAL_FEE_PREFIX },
          },
        }),
        prisma.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { ...baseWhere, status: "PENDING" },
        }),
        prisma.ledgerEntry.aggregate({
          _sum: { amount: true },
          where: { ...baseWhere, status: "REVERSED" },
        }),
      ]);

    const history = await prisma.ledgerEntry.findMany({
      where: baseWhere,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const config = getCommissionConfig();

    return NextResponse.json({
      config: {
        businessRate: config.businessRate.toNumber(),
        creatorRate: config.creatorRate.toNumber(),
      },
      totals: {
        campaignFees: Number(campaignFeeAgg._sum.amount ?? 0),
        campaignFeeCount: campaignFeeAgg._count._all,
        withdrawalFees: Number(withdrawalFeeAgg._sum.amount ?? 0),
        withdrawalFeeCount: withdrawalFeeAgg._count._all,
        pendingFees: Number(pendingAgg._sum.amount ?? 0),
        reversedFees: Number(reversedAgg._sum.amount ?? 0),
      },
      history,
    });
  } catch (error) {
    console.error("Admin commissions error:", error);
    return NextResponse.json(
      { error: "خطا در دریافت کارمزدها." },
      { status: 500 }
    );
  }
}
