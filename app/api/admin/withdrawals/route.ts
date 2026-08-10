
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import type { Withdrawal } from "@/app/generated/prisma/client";

const VALID_STATUSES = new Set([
  "REQUESTED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 },
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const requestedStatus = searchParams.get("status");

    const statusFilter =
      requestedStatus && VALID_STATUSES.has(requestedStatus)
        ? requestedStatus
        : null;

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        ...(statusFilter
          ? { status: statusFilter as Withdrawal["status"] }
          : { status: { in: ["REQUESTED", "PROCESSING"] } }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            creatorProfile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    return NextResponse.json({
      ok: true,
      withdrawals,
    });
  } catch (error) {
    console.error("Admin withdrawals error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت برداشت‌ها." },
      { status: 500 },
    );
  }
}


