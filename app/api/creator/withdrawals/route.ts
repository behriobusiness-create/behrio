import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseAmountInput, requestWithdrawal } from "@/lib/wallet";

export async function POST(request: Request) {
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

    if (user.role !== "CREATOR") {
      return NextResponse.json(
        {
          error: "فقط خالقان محتوا می‌توانند برداشت کنند.",
        },
        {
          status: 403,
        },
      );
    }

    const body = await request.json();

    const { amount, iban, bankName } = body;

    const withdrawalAmount = parseAmountInput(amount);

    if (!withdrawalAmount) {
      return NextResponse.json(
        {
          error: "مبلغ برداشت نامعتبر است.",
        },
        {
          status: 400,
        },
      );
    }

    try {
      const withdrawal = await requestWithdrawal({
        userId: user.id,
        amount: withdrawalAmount,
        iban: typeof iban === "string" ? iban : null,
        bankName: typeof bankName === "string" ? bankName : null,
      });

      return NextResponse.json({
        ok: true,
        withdrawal,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "INVALID_AMOUNT") {
          return NextResponse.json(
            { error: "مبلغ برداشت نامعتبر است." },
            { status: 400 }
          );
        }
        if (error.message === "INSUFFICIENT_BALANCE") {
          return NextResponse.json(
            { error: "موجودی کافی نیست." },
            { status: 400 }
          );
        }
      }

      throw error;
    }
  } catch (error) {
    console.error("Withdrawal request error:", error);

    return NextResponse.json(
      {
        error: "خطا در ثبت برداشت.",
      },
      {
        status: 500,
      },
    );
  }
}
