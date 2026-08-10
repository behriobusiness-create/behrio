import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getAvailableBalance } from "@/lib/wallet";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "احراز هویت انجام نشده است.",
        },
        {
          status: 401,
        },
      );
    }

    const userId = user.id;

    const earned =
      await prisma.ledgerEntry.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          userId,
          type: "CREATOR_EARNING",
          status: "AVAILABLE",
        },
      });

    const withdrawn =
      await prisma.withdrawal.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          userId,
          status: "COMPLETED",
        },
      });

    const balance = await getAvailableBalance(prisma, userId);

    return NextResponse.json({
      wallet: {
        totalEarned: Number(earned._sum.amount ?? 0),
        totalWithdrawn: Number(withdrawn._sum.amount ?? 0),
        balance: balance.toNumber(),
        currency: "IRR",
      },
    });
  } catch (error) {
    console.error("Wallet error:", error);

    return NextResponse.json(
      {
        error: "خطا در دریافت کیف پول.",
      },
      {
        status: 500,
      },
    );
  }
}
