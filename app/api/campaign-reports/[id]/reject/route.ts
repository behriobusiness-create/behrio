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

    const body = await request.json().catch(() => ({}));

    const report = await prisma.campaignReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        note: true,
        campaignId: true,
        campaign: { select: { businessId: true } },
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

    const updated = await prisma.campaignReport.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        note:
          typeof body.note === "string" && body.note.trim()
            ? body.note.trim()
            : report.note,
      },
    });

    return NextResponse.json({ ok: true, report: updated });
  } catch (error) {
    console.error("Reject campaign report error:", error);

    return NextResponse.json(
      { error: "رد گزارش نمایش با خطا مواجه شد." },
      { status: 500 }
    );
  }
}