import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma, CampaignStatus } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { settleReservedIfTerminal } from "@/lib/wallet";
import { settleCampaign } from "@/lib/finance/commission";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const businessTransitions: Record<string, string[]> = {
  DRAFT: ["PENDING_REVIEW"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "COMPLETED"],
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 },
      );
    }

    if (user.role !== "BUSINESS") {
      return NextResponse.json(
        { error: "دسترسی فقط برای Business است." },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    const body = await request.json();
    const { status: requestedStatus } = body;

    if (!requestedStatus || typeof requestedStatus !== "string") {
      return NextResponse.json(
        { error: "وضعیت جدید الزامی است." },
        { status: 400 },
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: {
        id,
      },
      include: {
        business: {
          select: {
            userId: true,
          },
        },
        integration: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "کمپین پیدا نشد." },
        { status: 404 },
      );
    }

    if (campaign.business.userId !== user.id) {
      return NextResponse.json(
        { error: "شما اجازه تغییر این کمپین را ندارید." },
        { status: 403 },
      );
    }

    const allowedTransitions =
      businessTransitions[campaign.status] ?? [];

    if (!allowedTransitions.includes(requestedStatus)) {
      return NextResponse.json(
        {
          error: `تغییر وضعیت از ${campaign.status} به ${requestedStatus} مجاز نیست.`,
        },
        { status: 400 },
      );
    }

    if (
      (requestedStatus === "PENDING_REVIEW" ||
        requestedStatus === "ACTIVE") &&
      campaign.integration?.status !== "VERIFIED"
    ) {
      return NextResponse.json(
        {
          error:
            "کمپین تا وقتی یکپارچه‌سازی (Conversion API) تأیید نشده، قابل ارسال برای بررسی یا فعال‌سازی نیست.",
        },
        { status: 400 },
      );
    }

    if (requestedStatus === "ACTIVE") {
      const now = new Date();

      if (campaign.endAt && campaign.endAt < now) {
        return NextResponse.json(
          { error: "زمان این کمپین به پایان رسیده است و نمی‌توان آن را فعال کرد." },
          { status: 400 },
        );
      }

      const remaining = new Prisma.Decimal(campaign.budget).sub(
        new Prisma.Decimal(campaign.spentAmount),
      );

      if (remaining.lte(0)) {
        return NextResponse.json(
          { error: "بودجه این کمپین مصرف شده است و نمی‌توان آن را فعال کرد." },
          { status: 400 },
        );
      }
    }

    const updatedCampaign = await prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.update({
        where: {
          id: campaign.id,
        },
        data: {
          status: requestedStatus as CampaignStatus,
        },
      });

      await settleReservedIfTerminal(tx, campaign.id);

      if (requestedStatus === "COMPLETED") {
        await settleCampaign(tx, campaign.id);
      }

      return updated;
    });

    return NextResponse.json({
      ok: true,
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error("Update campaign status error:", error);

    return NextResponse.json(
      { error: "تغییر وضعیت کمپین با خطا مواجه شد." },
      { status: 500 },
    );
  }
}
