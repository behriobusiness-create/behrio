import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateClickId } from "@/lib/integrations/keys";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

function hashIp(ip: string) {
  return createHash("sha256")
    .update(ip)
    .digest("hex");
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const { code } = await context.params;

    const trackingLink =
      await prisma.trackingLink.findUnique({
        where: {
          code,
        },
        include: {
          creator: {
            select: {
              userId: true,
            },
          },
          campaign: {
            select: {
              id: true,
              status: true,
              type: true,
              destinationUrl: true,
              startAt: true,
              endAt: true,
              budget: true,
              spentAmount: true,
              rewardPerClick: true,
            },
          },
        },
      });

    if (!trackingLink) {
      return NextResponse.json(
        {
          error: "Tracking Link پیدا نشد.",
        },
        {
          status: 404,
        },
      );
    }

    if (trackingLink.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "این Tracking Link فعال نیست.",
        },
        {
          status: 410,
        },
      );
    }

    const now = new Date();

    if (
      trackingLink.expiresAt &&
      trackingLink.expiresAt <= now
    ) {
      return NextResponse.json(
        {
          error: "این Tracking Link منقضی شده است.",
        },
        {
          status: 410,
        },
      );
    }

    if (
      trackingLink.campaign.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          error: "این کمپین فعال نیست.",
        },
        {
          status: 410,
        },
      );
    }

    if (
      trackingLink.campaign.startAt &&
      trackingLink.campaign.startAt > now
    ) {
      return NextResponse.json(
        {
          error: "این کمپین هنوز شروع نشده است.",
        },
        {
          status: 410,
        },
      );
    }

    if (
      trackingLink.campaign.endAt &&
      trackingLink.campaign.endAt <= now
    ) {
      return NextResponse.json(
        {
          error: "این کمپین تمام شده است.",
        },
        {
          status: 410,
        },
      );
    }

    if (
      !trackingLink.campaign.destinationUrl
    ) {
      return NextResponse.json(
        {
          error:
            "مقصد کمپین تنظیم نشده است.",
        },
        {
          status: 500,
        },
      );
    }

    const forwardedFor =
      request.headers.get(
        "x-forwarded-for",
      );

    const ip =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      "unknown";

    const userAgent =
      request.headers.get(
        "user-agent",
      );

    const referrer =
      request.headers.get(
        "referer",
      );

    let newClickId: string | null = null;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Campaign" WHERE id = ${trackingLink.campaignId} FOR UPDATE
      `;

      if (locked.length === 0) {
        return;
      }

      const campaign = await tx.campaign.findUnique({
        where: { id: trackingLink.campaignId },
        select: {
          id: true,
          status: true,
          type: true,
          budget: true,
          spentAmount: true,
          rewardPerClick: true,
          clickRewardPerGroup: true,
        },
      });

      if (!campaign || campaign.status !== "ACTIVE") {
        return;
      }

      if (ip !== "unknown") {
        const recentClick = await tx.click.findFirst({
          where: {
            trackingLinkId: trackingLink.id,
            ipHash: hashIp(ip),
            clickedAt: {
              gt: new Date(Date.now() - 10_000),
            },
          },
          select: { id: true, clickId: true },
        });

        if (recentClick) {
          newClickId = recentClick.clickId;
          return;
        }
      }

      const isCpc =
        campaign.type === "CPC" ||
        campaign.type === "CPA";
      const groupSize =
        isCpc && campaign.clickRewardPerGroup
          ? campaign.clickRewardPerGroup
          : 1;
      const reward =
        campaign.rewardPerClick &&
        campaign.rewardPerClick.gt(0)
          ? campaign.rewardPerClick
          : null;

      if (isCpc && reward) {
        const remaining = campaign.budget.sub(
          campaign.spentAmount
        );

        if (reward.gt(remaining)) {
          return;
        }
      }

      const createdClick = await tx.click.create({
        data: {
          trackingLinkId:
            trackingLink.id,
          clickId: generateClickId(),
          ipHash:
            ip !== "unknown"
              ? hashIp(ip)
              : null,
          userAgent,
          referrer,
        },
      });

      newClickId = createdClick.clickId;

      if (isCpc && reward) {
        const unpaid = await tx.click.count({
          where: {
            trackingLinkId: trackingLink.id,
            creditedAt: null,
          },
        });

        const batches = Math.floor(
          unpaid / groupSize,
        );

        if (batches >= 1) {
          const remaining =
            campaign.budget.sub(
              campaign.spentAmount,
            );

          if (reward.gt(remaining)) {
            return;
          }

          const payableBatches = Math.min(
            batches,
            Number(remaining.div(reward).floor()),
          );

          if (payableBatches >= 1) {
            const now = new Date();

            for (let b = 0; b < payableBatches; b++) {
              const conversion =
                await tx.conversion.create({
                  data: {
                    trackingLinkId: trackingLink.id,
                    campaignId: campaign.id,
                    amount: reward,
                    status: "APPROVED",
                    approvedAt: now,
                  },
                });

              await tx.ledgerEntry.create({
                data: {
                  userId: trackingLink.creator.userId,
                  campaignId: campaign.id,
                  conversionId: conversion.id,
                  type: "CREATOR_EARNING",
                  status: "AVAILABLE",
                  amount: reward,
                  currency: "IRR",
                  description: "CPC click batch earning",
                },
              });
            }

            await tx.campaign.update({
              where: { id: campaign.id },
              data: {
                spentAmount: { increment: reward.mul(payableBatches) },
              },
            });

            const clicksToCredit =
              await tx.click.findMany({
                where: {
                  trackingLinkId: trackingLink.id,
                  creditedAt: null,
                },
                orderBy: { clickedAt: "asc" },
                take: payableBatches * groupSize,
                select: { id: true },
              });

            if (clicksToCredit.length > 0) {
              await tx.click.updateMany({
                where: {
                  id: { in: clicksToCredit.map((c) => c.id) },
                },
                data: { creditedAt: now },
              });
            }
          }
        }
      }
    });

    let destination = trackingLink.campaign.destinationUrl;

    if (newClickId) {
      try {
        const url = new URL(destination);
        url.searchParams.set("behrio_click_id", newClickId);
        destination = url.toString();
      } catch {
        // keep original if destination URL is not parseable
      }
    }

    const response = NextResponse.redirect(destination);

    if (newClickId) {
      response.cookies.set("behrio_click_id", newClickId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    console.error("Tracking click error:", error);

    return NextResponse.json(
      {
        error: "ثبت کلیک با خطا مواجه شد.",
      },
      {
        status: 500,
      },
    );
  }
}
