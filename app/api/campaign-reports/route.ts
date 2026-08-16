import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MAX_CLAIMED = 50_000_000;

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();

    if (!actor) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    if (actor.role !== "CREATOR") {
      return NextResponse.json(
        { error: "فقط خالقان محتوا می‌توانند گزارش نمایش ثبت کنند." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const candidateId = typeof body.campaignId === "string" ? body.campaignId : "";
    const rawImpressions = Number(body.claimedImpressions);

    if (!candidateId) {
      return NextResponse.json(
        { error: "شناسه کمپین الزامی است." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(rawImpressions) ||
      rawImpressions <= 0 ||
      !Number.isInteger(rawImpressions)
    ) {
      return NextResponse.json(
        { error: "تعداد نمایش باید عدد صحیح بزرکتر از صفر باشد." },
        { status: 400 }
      );
    }

    if (rawImpressions < 1000) {
      return NextResponse.json(
        { error: "حداقل ۱۰۰۰ نمایش برای ثبت گزارش الزامی است." },
        { status: 400 }
      );
    }

    if (rawImpressions > MAX_CLAIMED) {
      return NextResponse.json(
        { error: "تعداد نمایش بیش از حد مجاز است." },
        { status: 400 }
      );
    }

    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: actor.id },
    });

    if (!creatorProfile) {
      return NextResponse.json(
        { error: "پروفایل خالق محتوا پیدا نشد." },
        { status: 404 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: candidateId },
      include: {
        trackingLinks: {
          where: {
            creatorId: creatorProfile.id,
            status: "ACTIVE",
          },
          select: { id: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "کمپین پیدا نشد." },
        { status: 404 }
      );
    }

    if (campaign.type !== "CPM") {
      return NextResponse.json(
        { error: "برای این نوع کمپین گزارش نمایش ثبت نمی‌شود." },
        { status: 400 }
      );
    }

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "این کمپین فعال نیست." },
        { status: 400 }
      );
    }

    if (campaign.trackingLinks.length === 0) {
      return NextResponse.json(
        { error: "شما در این کمپین همکاری فعال ندارید." },
        { status: 403 }
      );
    }

    if (!campaign.cpm || campaign.cpm.lte(0)) {
      return NextResponse.json(
        { error: "نرخ CPM برای این کمپین تنظیم نشده است." },
        { status: 400 }
      );
    }

    const screenshotUrl =
      typeof body.screenshotUrl === "string" && body.screenshotUrl.trim()
        ? body.screenshotUrl.trim()
        : "";

    if (!screenshotUrl) {
      return NextResponse.json(
        { error: "آپلود اسکرین‌شات مدرک الزامی است." },
        { status: 400 }
      );
    }

    const report = await prisma.campaignReport.create({
      data: {
        campaignId: campaign.id,
        creatorId: creatorProfile.id,
        screenshotUrl,
        claimedImpressions: rawImpressions,
        note:
          typeof body.note === "string" && body.note.trim()
            ? body.note.trim()
            : null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    console.error("Create campaign report error:", error);

    return NextResponse.json(
      { error: "ثبت گزارش نمایش با خطا مواجه شد." },
      { status: 500 }
    );
  }
}