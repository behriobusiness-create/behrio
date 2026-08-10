import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isRateLimited } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();

    if (!actor) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    if (await isRateLimited("conversion:create", actor.id, 60, 60_000)) {
      return NextResponse.json(
        { error: "درخواست‌های بیش از حد. کمی بعد تلاش کنید." },
        { status: 429 }
      );
    }

    const body = await request.json();

    const {
      trackingLinkCode,
      amount,
      externalOrderId,
    } = body;

    if (!trackingLinkCode) {
      return NextResponse.json(
        { error: "کد Tracking Link الزامی است." },
        { status: 400 }
      );
    }

    let parsedAmount: number | null = null;
    if (amount !== undefined && amount !== null && amount !== "") {
      parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: "مبلغ Conversion نامعتبر است." },
          { status: 400 }
        );
      }
    }

    const trackingLink = await prisma.trackingLink.findUnique({
      where: {
        code: trackingLinkCode,
      },
      include: {
        campaign: true,
      },
    });

    if (!trackingLink) {
      return NextResponse.json(
        { error: "Tracking Link پیدا نشد." },
        { status: 404 }
      );
    }

    const creatorProfile = actor.role === "CREATOR"
      ? await prisma.creatorProfile.findUnique({
          where: { userId: actor.id },
          select: { id: true },
        })
      : null;

    if (!creatorProfile || trackingLink.creatorId !== creatorProfile.id) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز." },
        { status: 403 }
      );
    }

    if (trackingLink.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Tracking Link فعال نیست." },
        { status: 400 }
      );
    }

    if (trackingLink.campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Campaign فعال نیست." },
        { status: 400 }
      );
    }

    if (externalOrderId) {
      const existing = await prisma.conversion.findFirst({
        where: {
          trackingLinkId: trackingLink.id,
          externalOrderId,
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            ok: true,
            existing: true,
            conversion: existing,
          },
          { status: 200 }
        );
      }
    }

    const conversion = await prisma.conversion.create({
      data: {
        trackingLinkId: trackingLink.id,
        campaignId: trackingLink.campaignId,
        amount: parsedAmount,
        externalOrderId: externalOrderId ?? null,
        screenshot:
          typeof body.screenshot === "string" && body.screenshot.trim()
            ? body.screenshot.trim()
            : null,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        conversion,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Create conversion error:", error);

    return NextResponse.json(
      { error: "ساخت Conversion با خطا مواجه شد." },
      { status: 500 }
    );
  }
}
