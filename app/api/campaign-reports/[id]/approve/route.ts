import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { settleCampaign } from "@/lib/finance/commission";

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

    const report = await prisma.campaignReport.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            businessId: true,
            type: true,
            budget: true,
            spentAmount: true,
            rewardPerThousand: true,
          },
        },
        creator: { select: { userId: true } },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "گزارش نمایش پیدا نشد." },
        { status: 404 }
      );
    }

    const isAdmin = actor.role === "ADMIN";
    const isCampaignOwner = report.campaign.businessId
      ? await prisma.businessProfile.findFirst({
          where: {
            id: report.campaign.businessId,
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

    if (report.status !== "PENDING") {
      return NextResponse.json(
        { error: "این گزارش قبلاً بررسی شده است." },
        { status: 400 }
      );
    }

    const cmp = report.campaign;

    if (cmp.type !== "CPM" && cmp.type !== "CLIPPING") {
      return NextResponse.json(
        { error: "این کمپین بر اساس نمایش پرداخت نمی‌شود." },
        { status: 400 }
      );
    }

    const rewardPerThousand = cmp.rewardPerThousand;

    if (!rewardPerThousand || rewardPerThousand.lte(0)) {
      return NextResponse.json(
        { error: "نرخ هر هزار نمایش برای این کمپین تنظیم نشده است." },
        { status: 400 }
      );
    }

    const groups = Math.floor(report.claimedImpressions / 1000);

    if (groups < 1) {
      return NextResponse.json(
        { error: "حداقل ۱۰۰۰ نمایش برای پرداخت الزامی است." },
        { status: 400 }
      );
    }

    const totalReward = rewardPerThousand.mul(groups);
    const creatorUserId = report.creator.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reportRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "CampaignReport" WHERE id = ${id} FOR UPDATE
      `;

      if (reportRows.length === 0) {
        return null;
      }

      const current = await tx.campaignReport.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!current || current.status !== "PENDING") {
        return undefined;
      }

      const campaignRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Campaign" WHERE id = ${report.campaignId} FOR UPDATE
      `;

      if (campaignRows.length === 0) {
        return "NO_CAMPAIGN";
      }

      const currentCampaign = await tx.campaign.findUnique({
        where: { id: report.campaignId },
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

      const remaining = currentCampaign.budget.sub(currentCampaign.spentAmount);

      if (totalReward.gt(remaining)) {
        return "BUDGET_EXCEEDED";
      }

      const now = new Date();

      const trackingLink = await tx.trackingLink.findFirst({
        where: { campaignId: report.campaignId, creatorId: report.creatorId },
        select: { id: true },
      });

      if (!trackingLink) {
        return "NO_TRACKING_LINK";
      }

      await tx.campaignReport.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: now,
        },
      });

      const createdConversions = [];
      for (let g = 0; g < groups; g++) {
        const conversion = await tx.conversion.create({
          data: {
            trackingLinkId: trackingLink.id,
            campaignId: report.campaignId,
            amount: rewardPerThousand,
            status: "APPROVED",
            approvedAt: now,
          },
        });
        createdConversions.push(conversion);

        await tx.ledgerEntry.create({
          data: {
            userId: creatorUserId,
            campaignId: report.campaignId,
            conversionId: conversion.id,
            type: "CREATOR_EARNING",
            status: "AVAILABLE",
            amount: rewardPerThousand,
            currency: "IRR",
            description: "Impressions report reward (per 1000 views)",
          },
        });
      }

      const updatedCampaign = await tx.campaign.update({
        where: { id: report.campaignId },
        data: {
          spentAmount: { increment: totalReward },
        },
      });

      if (updatedCampaign.spentAmount.gte(updatedCampaign.budget)) {
        const completed = await tx.campaign.update({
          where: { id: report.campaignId },
          data: {
            status: "COMPLETED",
            reservedAmount: updatedCampaign.spentAmount,
          },
        });

        await settleCampaign(tx, report.campaignId);

        return { conversions: createdConversions, campaign: completed };
      }

      return { conversions: createdConversions, campaign: updatedCampaign };
    });

    if (result === null) {
      return NextResponse.json(
        { error: "گزارش نمایش پیدا نشد." },
        { status: 404 }
      );
    }

    if (result === undefined) {
      return NextResponse.json(
        { error: "این گزارش قبلاً بررسی شده است." },
        { status: 400 }
      );
    }

    if (result === "NO_CAMPAIGN") {
      return NextResponse.json(
        { error: "کمپین این گزارش پیدا نشد." },
        { status: 404 }
      );
    }

    if (result === "NO_TRACKING_LINK") {
      return NextResponse.json(
        { error: "لینک پیگیری خالق برای این کمپین پیدا نشد." },
        { status: 404 }
      );
    }

    if (result === "BUDGET_EXCEEDED") {
      return NextResponse.json(
        {
          error:
            "بودجه کمپین برای پرداخت این گزارش کافی نیست. ابتدا کمپین را شارژ کنید.",
          required: Number(totalReward.toFixed(2)),
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      groups,
      totalReward: Number(totalReward.toFixed(2)),
      ...result,
    });
  } catch (error) {
    console.error("Approve campaign report error:", error);

    return NextResponse.json(
      { error: "تأیید گزارش نمایش با خطا مواجه شد." },
      { status: 500 }
    );
  }
}