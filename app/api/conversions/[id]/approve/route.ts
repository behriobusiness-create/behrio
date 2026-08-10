import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import {
  maybeAutoCloseCampaign,
  settleCampaign,
} from "@/lib/finance/commission";

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
        trackingLink: {
          include: {
            creator: {
              include: {
                user: true,
              },
            },
          },
        },
        campaign: {
          select: {
            id: true,
            businessId: true,
            type: true,
            budget: true,
            spentAmount: true,
            rewardPerConversion: true,
            commissionPercent: true,
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

    const cmp = conversion.campaign;

    let reward: Prisma.Decimal;

    if (cmp.type === "AFFILIATE" && cmp.commissionPercent) {
      const base = conversion.amount ?? new Prisma.Decimal(0);
      reward = base.mul(cmp.commissionPercent).div(100);
      if (reward.lte(0)) {
        reward = cmp.rewardPerConversion ?? new Prisma.Decimal(0);
      }
    } else {
      reward =
        cmp.rewardPerConversion ??
        conversion.amount ??
        new Prisma.Decimal(0);
    }

    const creatorUserId = conversion.trackingLink.creator.userId;

    const result = await prisma.$transaction(
      async (tx) => {
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

        const campaignRows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Campaign" WHERE id = ${conversion.campaignId} FOR UPDATE
        `;

        if (campaignRows.length === 0) {
          return "NO_CAMPAIGN";
        }

        const currentCampaign = await tx.campaign.findUnique({
          where: { id: conversion.campaignId },
          select: {
            id: true,
            status: true,
            budget: true,
            spentAmount: true,
          },
        });

        if (!currentCampaign) {
          return "NO_CAMPAIGN";
        }

        if (currentCampaign.status !== "ACTIVE") {
          return "CAMPAIGN_NOT_ACTIVE";
        }

        const remaining = currentCampaign.budget.sub(
          currentCampaign.spentAmount,
        );

        if (reward.gt(remaining)) {
          return "BUDGET_EXCEEDED";
        }

        const updatedConversion =
          await tx.conversion.update({
            where: {
              id,
            },
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
            },
          });

        const ledger =
          await tx.ledgerEntry.create({
            data: {
              userId: creatorUserId,
              campaignId: conversion.campaignId,
              conversionId: conversion.id,
              type: "CREATOR_EARNING",
              status: "AVAILABLE",
              amount: reward,
              currency: "IRR",
              description:
                "Creator earning from approved conversion",
            },
          });

        const campaign =
          await tx.campaign.update({
            where: {
              id: conversion.campaignId,
            },
            data: {
              spentAmount: {
                increment: reward,
              },
            },
          });

        let updatedCampaign =
          campaign;

        let autoClosed = false;
        let autoCloseReason: string | null = null;

        if (
          campaign.spentAmount.gte(
            campaign.budget
          )
        ) {
          updatedCampaign =
            await tx.campaign.update({
              where: {
                id: campaign.id,
              },
              data: {
                status: "COMPLETED",
                reservedAmount: campaign.spentAmount,
              },
            });

          await settleCampaign(
            tx,
            campaign.id,
          );

          autoClosed = true;
          autoCloseReason = "BUDGET_EXHAUSTED";
        } else {
          const result =
            await maybeAutoCloseCampaign(
              tx,
              campaign.id,
            );

          if (result.completed) {
            autoClosed = true;
            autoCloseReason = result.reason;
          }
        }

        return {
          updatedConversion,
          ledger,
          campaign: updatedCampaign,
          autoClosed,
          autoCloseReason,
        };
      }
    );

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

    if (result === "BUDGET_EXCEEDED") {
      return NextResponse.json(
        { error: "بودجه کمپین برای پرداخت این تبدیل کافی نیست." },
        { status: 409 }
      );
    }

    if (result === "NO_CAMPAIGN") {
      return NextResponse.json(
        { error: "کمپین این Conversion پیدا نشد." },
        { status: 404 }
      );
    }

    if (result === "CAMPAIGN_NOT_ACTIVE") {
      return NextResponse.json(
        { error: "کمپین فعال نیست و امکان تأیید تبدیل وجود ندارد." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
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
