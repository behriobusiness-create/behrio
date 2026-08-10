import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

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

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { businessProfile: true },
    });

    if (!fullUser || fullUser.role !== "BUSINESS" || !fullUser.businessProfile) {
      return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
    }

    const { id: campaignId } = await context.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.businessId !== fullUser.businessProfile.id) {
      return NextResponse.json({ error: "Campaign پیدا نشد." }, { status: 404 });
    }

    const body = await request.json();
    const { creatorId } = body;

    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator پیدا نشد." }, { status: 404 });
    }

    const existingLink = await prisma.trackingLink.findUnique({
      where: {
        campaignId_creatorId: {
          campaignId,
          creatorId,
        },
      },
    });

    if (existingLink) {
      return NextResponse.json({
        ok: true,
        existing: true,
        trackingLink: existingLink,
        url: `/t/${existingLink.code}`,
      });
    }

    const application = await prisma.campaignApplication.findUnique({
      where: {
        campaignId_creatorId: {
          campaignId,
          creatorId,
        },
      },
      select: { status: true },
    });

    if (!application || application.status !== "APPROVED") {
      return NextResponse.json(
        { error: "این Creator برای این کمپین تأیید نشده است." },
        { status: 403 }
      );
    }

    const code = await generateUniqueCode();

    const trackingLink = await prisma.trackingLink.create({
      data: {
        campaignId,
        creatorId,
        code,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      ok: true,
      trackingLink,
      url: `/t/${code}`,
    });
  } catch (error) {
    console.error("Create tracking link error:", error);
    return NextResponse.json({ error: "خطا در ساخت لینک." }, { status: 500 });
  }
}
