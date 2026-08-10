import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBusinessProfileForUser, findCampaignOwnedByBusiness, getIntegrationWithApiKey } from "@/lib/integrations/business";
import { generateClickId } from "@/lib/integrations/keys";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت انجام نشده است." }, { status: 401 });
    }

    const profile = await getBusinessProfileForUser(user.id);
    if (!profile || profile.role !== "BUSINESS" || !profile.businessProfile) {
      return NextResponse.json({ error: "دسترسی فقط برای Business است." }, { status: 403 });
    }

    const { id: campaignId } = await context.params;
    const campaign = await findCampaignOwnedByBusiness(campaignId, profile.businessProfile.id);
    if (!campaign) {
      return NextResponse.json({ error: "کمپین پیدا نشد." }, { status: 404 });
    }

    const integration = await getIntegrationWithApiKey(campaignId);

    if (!integration?.apiKey) {
      return NextResponse.json(
        { error: "برای شروع تأیید، ابتدا کلید API بسازید." },
        { status: 400 }
      );
    }

    if (integration.apiKey.revokedAt) {
      return NextResponse.json(
        { error: "کلید API لغو شده است. ابتدا کلید جدید بسازید." },
        { status: 400 }
      );
    }

    if (integration.status === "DISABLED") {
      return NextResponse.json(
        { error: "این یکپارچه‌سازی غیرفعال شده است." },
        { status: 400 }
      );
    }

    const testClickId = generateClickId(true);

    const updated = await prisma.campaignIntegration.update({
      where: { id: integration.id },
      data: {
        status: "VERIFICATION_PENDING",
        testClickId,
        verifiedAt: null,
        lastVerifiedAt: null,
        revokedAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
      status: updated.status,
      testClickId,
      instructions: {
        method: "POST",
        url: "/api/v1/integrations/conversions",
        example: {
          clickId: testClickId,
          orderId: "TEST-12345",
          amount: 1000,
          currency: "IRR",
          status: "TEST",
        },
      },
      message:
        "برای تکمیل تأیید، یک درخواست تست با clickId بالا به Conversion API بفرستید.",
    });
  } catch (error) {
    console.error("Start verification error:", error);
    return NextResponse.json({ error: "خطا در شروع تأیید یکپارچه‌سازی." }, { status: 500 });
  }
}
