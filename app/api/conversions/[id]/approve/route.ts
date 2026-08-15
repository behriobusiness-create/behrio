import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const actor = await getCurrentUser();

    if (!actor) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const conversion = await prisma.conversion.findUnique({
      where: {
        id,
      },
      include: {
        campaign: {
          select: {
            id: true,
            businessId: true,
            type: true,
          },
        },
      },
    });

    if (!conversion) {
      return NextResponse.json(
        { error: "Conversion پیدا نشد." },
        { status: 404 }
      );
    }

    const isAdmin = actor.role === "ADMIN";
    const isCampaignOwner = conversion.campaign.businessId
      ? await prisma.businessProfile.findFirst({
          where: {
            id: conversion.campaign.businessId,
            userId: actor.id,
          },
        })
      : null;

    if (!isAdmin && !isCampaignOwner) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز." },
        { status: 403 }
      );
    }

    if (conversion.status !== "PENDING") {
      return NextResponse.json(
        { error: "Conversion قابل تأیید نیست." },
        { status: 400 }
      );
    }

    // Behrio pays creators exclusively via verified impressions (CPM).
    // Approving a conversion only records the business outcome for tracking;
    // it does not move money.
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Conversion" WHERE id = ${id} FOR UPDATE
      `;

      if (rows.length === 0) {
        return null;
      }

      const current = await tx.conversion.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!current || current.status !== "PENDING") {
        return undefined;
      }

      return tx.conversion.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
    });

    if (result === null) {
      return NextResponse.json(
        { error: "Conversion پیدا نشد." },
        { status: 404 }
      );
    }

    if (result === undefined) {
      return NextResponse.json(
        { error: "Conversion قابل تأیید نیست." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversion: result,
      note: "در مدل CPM، تبدیل‌ها پرداخت مستقیم ندارند؛ درآمد از نمایش‌های تأییدشده محاسبه می‌شود.",
    });
  } catch (error) {
    console.error(
      "Approve conversion error:",
      error
    );

    return NextResponse.json(
      {
        error: "تأیید Conversion با خطا مواجه شد.",
      },
      {
        status: 500,
      }
    );
  }
}
