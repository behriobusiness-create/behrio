import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getBusinessWallet } from "@/lib/wallet";
import { isProduction } from "@/lib/env";

const MIN_AMOUNT = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    if (isProduction()) {
      return NextResponse.json(
        { error: "درگاه پرداخت آزمایشی در محیط تولید در دسترس نیست." },
        { status: 403 }
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const amount = new Prisma.Decimal(String(body.amount ?? ""));

    if (amount.isNaN() || amount.lte(0) || amount.lt(MIN_AMOUNT)) {
      return NextResponse.json(
        { error: `حداقل مبلغ شارژ کیف پول ${new Intl.NumberFormat("fa-IR").format(MIN_AMOUNT)} تومان است.` },
        { status: 400 }
      );
    }

    const transactionId = `sandbox_${randomBytes(8).toString("hex")}`;

    await sleep(600);

    const wallet = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE
      `;
      if (rows.length === 0) return null;

      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          type: "CAMPAIGN_FUNDING",
          status: "AVAILABLE",
          amount,
          currency: "IRR",
          description: `شارژ کیف پول از درگاه آزمایشی (${transactionId})`,
        },
      });

      return getBusinessWallet(tx, user.id);
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "کاربر پیدا نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      transactionId,
      amount: amount.toNumber(),
      wallet: {
        funded: wallet.funded.toNumber(),
        reserved: wallet.reserved.toNumber(),
        available: wallet.available.toNumber(),
      },
      message: "پرداخت آزمایشی موفق بود. موجودی کیف پول افزایش یافت.",
    });
  } catch (error) {
    console.error("Sandbox payment error:", error);
    return NextResponse.json(
      { error: "خطا در پردازش پرداخت آزمایشی." },
      { status: 500 }
    );
  }
}
