import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBusinessProfileForUser, findCampaignOwnedByBusiness } from "@/lib/integrations/business";
import { hashApiKey } from "@/lib/integrations/keys";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

    const integration = await prisma.campaignIntegration.findUnique({
      where: { campaignId },
      include: { apiKey: true },
    });
    if (!integration?.apiKey) {
      return NextResponse.json({ error: "ابتدا کلید API بسازید." }, { status: 400 });
    }
    if (integration.apiKey.revokedAt) {
      return NextResponse.json({ error: "کلید API لغو شده است." }, { status: 400 });
    }
    if (integration.status === "DISABLED") {
      return NextResponse.json({ error: "این یکپارچه‌سازی غیرفعال شده است." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const providedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const orderId = typeof body.orderId === "string" && body.orderId.trim()
      ? body.orderId.trim()
      : "TEST-12345";

    if (!providedKey) {
      return NextResponse.json(
        { error: "برای اجرای تست، کلید API را وارد کنید." },
        { status: 400 }
      );
    }

    if (hashApiKey(providedKey) !== integration.apiKey.keyHash) {
      return NextResponse.json(
        { error: "کلید API معتبر نیست یا به این کمپین تعلق ندارد." },
        { status: 403 }
      );
    }

    const testClickId = integration.testClickId || `test_clk_${Date.now().toString(16)}`;

    const now = new Date();
    await prisma.campaignIntegration.update({
      where: { id: integration.id },
      data: {
        status: "VERIFIED",
        verifiedAt: now,
        lastVerifiedAt: now,
        verifiedBy: "business-test",
        testClickId,
        verificationMeta: {
          method: "business-test",
          orderId,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      status: "VERIFIED",
      testClickId,
      message: "تست موفق بود. یکپارچه‌سازی تأیید شد.",
    });
  } catch (error) {
    console.error("Run integration test error:", error);
    return NextResponse.json({ error: "خطا در اجرای تست یکپارچه‌سازی." }, { status: 500 });
  }
}
