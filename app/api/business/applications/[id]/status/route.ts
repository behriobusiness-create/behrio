import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  campaignHasCapacity,
  lockCampaignForCapacityCheck,
} from "@/lib/campaign/capacity";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(6).toString("hex");
    const existing = await prisma.trackingLink.findUnique({ where: { code } });
    if (!existing) {
      return code;
    }
  }
  return randomBytes(12).toString("hex");
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        role: true,
        businessProfile: { select: { id: true } },
      },
    });

    if (!fullUser) {
      return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
    }

    if (fullUser.role !== "BUSINESS") {
      return NextResponse.json(
        { error: "فقط کسب‌وکارها می‌توانند درخواست‌ها را بررسی کنند." },
        { status: 403 }
      );
    }

    if (!fullUser.businessProfile) {
      return NextResponse.json(
        { error: "پروفایل کسب‌وکار کامل نشده است." },
        { status: 400 }
      );
    }

    const { id: applicationId } = await context.params;

    const body = await request.json();
    const { status } = body;

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json(
        { error: "وضعیت درخواست نامعتبر است." },
        { status: 400 }
      );
    }

    const application =
      await prisma.campaignApplication.findUnique({
        where: { id: applicationId },
        include: {
          campaign: {
            select: {
              id: true,
              businessId: true,
              status: true,
            },
          },
        },
      });

    if (!application) {
      return NextResponse.json({ error: "درخواست پیدا نشد." }, { status: 404 });
    }

    if (application.campaign.businessId !== fullUser.businessProfile.id) {
      return NextResponse.json(
        { error: "این درخواست متعلق به کسب‌وکار شما نیست." },
        { status: 403 }
      );
    }

    if (application.status !== "PENDING") {
      return NextResponse.json(
        { error: "این درخواست قبلاً بررسی شده است." },
        { status: 400 }
      );
    }

    if (application.campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "کمپین فعال نیست." },
        { status: 400 }
      );
    }

    if (status === "APPROVED") {
      const capacityResult = await prisma.$transaction(async (tx) => {
        const campaign = await lockCampaignForCapacityCheck(
          tx,
          application.campaignId
        );
        if (!campaign) return { ok: false, reason: "کمپین پیدا نشد." };
        return campaignHasCapacity(campaign);
      });

      if (!capacityResult.ok) {
        return NextResponse.json(
          { error: capacityResult.reason },
          { status: 400 }
        );
      }
    }

    const updatedApplication =
      await prisma.campaignApplication.update({
        where: { id: application.id },
        data: {
          status,
          reviewedAt: new Date(),
        },
      });

    let trackingLink = null;

    if (status === "APPROVED") {
      trackingLink = await prisma.trackingLink.findUnique({
        where: {
          campaignId_creatorId: {
            campaignId: application.campaignId,
            creatorId: application.creatorId,
          },
        },
      });

      if (!trackingLink) {
        const code = await generateUniqueCode();
        trackingLink = await prisma.trackingLink.create({
          data: {
            campaignId: application.campaignId,
            creatorId: application.creatorId,
            code,
            status: "ACTIVE",
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      application: updatedApplication,
      trackingLink,
    });
  } catch (error) {
    console.error("Business application review error:", error);
    return NextResponse.json(
      { error: "بررسی درخواست با خطا مواجه شد." },
      { status: 500 }
    );
  }
}
