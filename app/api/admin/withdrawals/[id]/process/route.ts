import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { setWithdrawalFeeLedger } from "@/lib/finance/commission";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
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

    const { id } = await context.params;

    let action: "APPROVE" | "REJECT" = "APPROVE";
    let failureReason: string | null = null;

    try {
      const body = await request.json();
      if (body && typeof body === "object") {
        if (body.action === "REJECT") {
          action = "REJECT";
        }
        if (typeof body.failureReason === "string") {
          failureReason = body.failureReason;
        }
      }
    } catch {
      // empty body => default to APPROVE
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Withdrawal" WHERE id = ${id} FOR UPDATE
      `;

      if (rows.length === 0) {
        return null;
      }

      const current = await tx.withdrawal.findUnique({
        where: { id },
      });

      if (
        !current ||
        (current.status !== "REQUESTED" && current.status !== "PROCESSING")
      ) {
        return undefined;
      }

      if (action === "REJECT") {
        const updated = await tx.withdrawal.update({
          where: { id },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            failureReason:
              failureReason?.trim() || "درخواست توسط ادمین رد شد.",
          },
        });

        await setWithdrawalFeeLedger(tx, current, "REVERSED");

        return updated;
      }

      const updated = await tx.withdrawal.update({
        where: { id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          failureReason: null,
        },
      });

      await setWithdrawalFeeLedger(tx, current, "AVAILABLE");

      return updated;
    });

    if (withdrawal === null) {
      return NextResponse.json(
        { error: "درخواست برداشت پیدا نشد." },
        { status: 404 }
      );
    }

    if (withdrawal === undefined) {
      return NextResponse.json(
        { error: "این درخواست قابل پردازش نیست." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      withdrawal,
    });
  } catch (error) {
    console.error("Process withdrawal error:", error);

    return NextResponse.json(
      {
        error: "پردازش برداشت ناموفق بود.",
      },
      { status: 500 }
    );
  }
}
