import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { getBusinessWallet } from "@/lib/wallet";

const MIN_AMOUNT = 10_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const { id: campaignId } = await context.params;

    const body = await request.json();
    const amount = new Prisma.Decimal(String(body.amount ?? ""));

    if (amount.isNaN() || amount.lte(0) || amount.lt(MIN_AMOUNT)) {
      return NextResponse.json(
        { error: `حداقل مبلغ انتقال ${new Intl.NumberFormat("fa-IR").format(MIN_AMOUNT)} تومان است.` },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, businessId: true, name: true, status: true },
      });

      if (!campaign) return { error: "NOT_FOUND" };

      const business = await tx.businessProfile.findUnique({
        where: { id: campaign.businessId },
        select: { userId: true },
      });

      if (!business || business.userId !== user.id) {
        return { error: "FORBIDDEN" };
      }

      const userRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE
      `;
      if (userRows.length === 0) return { error: "NOT_FOUND" };

      const wallet = await getBusinessWallet(tx, user.id);

      if (amount.gt(wallet.available)) {
        return { error: "INSUFFICIENT_BALANCE", wallet };
      }

      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          campaignId,
          type: "CAMPAIGN_FUNDING",
          status: "AVAILABLE",
          amount,
          currency: "IRR",
          description: `انتقال از کیف پول به بودجه کمپین «${campaign.name}»`,
        },
      });

      const campaignUpdate = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          budget: { increment: amount },
          reservedAmount: { increment: amount },
          ...(campaign.status === "CANCELLED"
            ? { status: "ACTIVE" }
            : {}),
        },
      });

      return {
        ok: true,
        id: campaignUpdate.id,
        name: campaignUpdate.name,
        budget: campaignUpdate.budget,
        status: campaignUpdate.status,
      };
    });

    if (updated?.error === "NOT_FOUND") {
      return NextResponse.json(
        { error: "کمپین پیدا نشد." },
        { status: 404 }
      );
    }

    if (updated?.error === "FORBIDDEN") {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز. فقط صاحب کمپین می‌تواند بودجه اضافه کند." },
        { status: 403 }
      );
    }

    if (updated?.error === "INSUFFICIENT_BALANCE") {
      const wallet = updated.wallet as {
        available: Prisma.Decimal;
      };
      return NextResponse.json(
        {
          error: "موجودی کیف پول کافی نیست. لطفاً ابتدا کیف پول را شارژ کنید.",
          wallet: { available: wallet.available.toNumber() },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: updated,
      message: "بودجه کمپین با موفقیت از کیف پول افزایش یافت.",
    });
  } catch (error) {
    console.error("Fund campaign error:", error);
    return NextResponse.json(
      { error: "خطا در افزایش بودجه کمپین." },
      { status: 500 }
    );
  }
}
