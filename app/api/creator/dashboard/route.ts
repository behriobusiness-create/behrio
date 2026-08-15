import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getAvailableBalance } from "@/lib/wallet";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const fullUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        role: true,
        creatorProfile: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!fullUser) {
      return NextResponse.json(
        { error: "کاربر پیدا نشد." },
        { status: 404 }
      );
    }

    if (fullUser.role !== "CREATOR") {
      return NextResponse.json(
        {
          error:
            "فقط Creator ها به این بخش دسترسی دارند.",
        },
        { status: 403 }
      );
    }

    if (!fullUser.creatorProfile) {
      return NextResponse.json(
        {
          error:
            "پروفایل Creator پیدا نشد.",
        },
        { status: 400 }
      );
    }

    const creatorId = fullUser.creatorProfile.id;

    const earnings =
      await prisma.ledgerEntry.aggregate({
        where: {
          userId: user.id,
          type: "CREATOR_EARNING",
          status: "AVAILABLE",
        },
        _sum: {
          amount: true,
        },
      });

    const completedWithdrawals =
      await prisma.withdrawal.aggregate({
        where: {
          userId: user.id,
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

    const clicks =
      await prisma.click.count({
        where: {
          trackingLink: {
            creatorId,
          },
        },
      });

    const conversions =
      await prisma.conversion.count({
        where: {
          trackingLink: {
            creatorId,
          },
          status: "APPROVED",
        },
      });

    const campaigns =
      await prisma.campaignApplication.findMany({
        where: {
          creatorId,
          status: "APPROVED",
        },
        select: {
          id: true,
          status: true,
          appliedAt: true,
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              cpm: true,
              verifiedImpressions: true,
              status: true,
            },
          },
        },
        orderBy: {
          appliedAt: "desc",
        },
      });

    const trackingLinks =
      await prisma.trackingLink.findMany({
        where: {
          creatorId,
        },
        select: {
          id: true,
          code: true,
          status: true,
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    const totalEarned =
      Number(earnings._sum.amount ?? 0);

    const totalWithdrawn =
      Number(completedWithdrawals._sum.amount ?? 0);

    const availableBalance = await getAvailableBalance(prisma, user.id);

    return NextResponse.json({
      creator: {
        id: creatorId,
        name: fullUser.creatorProfile.displayName,
      },
      stats: {
        totalEarned,
        totalWithdrawn,
        availableBalance: availableBalance.toNumber(),
        clicks,
        conversions,
      },
      campaigns,
      trackingLinks,
    });
  } catch (error) {
    console.error("Creator dashboard error:", error);

    return NextResponse.json(
      {
        error: "خطا در دریافت داشبورد.",
      },
      { status: 500 }
    );
  }
}
