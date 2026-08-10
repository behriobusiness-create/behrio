import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBusinessProfileForUser, findCampaignOwnedByBusiness, getIntegrationWithApiKey } from "@/lib/integrations/business";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

    const apiKey = integration?.apiKey ?? null;

    const [conversions, clicks] = await Promise.all([
      prisma.conversion.count({
        where: { campaignId, source: "INTEGRATION" },
      }),
      prisma.click.count({
        where: { trackingLink: { campaignId } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        destinationUrl: campaign.destinationUrl,
      },
      integration: integration
        ? {
            id: integration.id,
            status: integration.status,
            verifiedAt: integration.verifiedAt,
            lastVerifiedAt: integration.lastVerifiedAt,
            revokedAt: integration.revokedAt,
            testClickId: integration.testClickId,
            verifiedBy: integration.verifiedBy,
            verificationMeta: integration.verificationMeta,
            apiKey: apiKey
              ? {
                  id: apiKey.id,
                  keyPrefix: apiKey.keyPrefix,
                  revokedAt: apiKey.revokedAt,
                  expiresAt: apiKey.expiresAt,
                  lastUsedAt: apiKey.lastUsedAt,
                }
              : null,
          }
        : null,
      endpoint: "/api/v1/integrations/conversions",
      stats: { conversions, clicks },
    });
  } catch (error) {
    console.error("Get integration error:", error);
    return NextResponse.json({ error: "خطا در دریافت وضعیت یکپارچه‌سازی." }, { status: 500 });
  }
}
