import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBusinessProfileForUser, findCampaignOwnedByBusiness, getIntegrationWithApiKey } from "@/lib/integrations/business";

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
      return NextResponse.json({ error: "کلید API برای این کمپین وجود ندارد." }, { status: 400 });
    }

    if (integration.apiKey.revokedAt) {
      return NextResponse.json({ error: "کلید API قبلاً لغو شده است." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.businessApiKey.update({
        where: { id: integration.apiKey.id },
        data: { revokedAt: new Date() },
      }),
      prisma.campaignIntegration.update({
        where: { id: integration.id },
        data: {
          status: "CONFIGURED",
          revokedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "کلید API لغو شد." });
  } catch (error) {
    console.error("Revoke api key error:", error);
    return NextResponse.json({ error: "خطا در لغو کلید API." }, { status: 500 });
  }
}
