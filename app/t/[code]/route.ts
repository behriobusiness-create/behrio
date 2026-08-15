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
              destinationUrl: true,
              startAt: true,
              endAt: true,
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
