import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBusinessProfileForUser, findCampaignOwnedByBusiness } from "@/lib/integrations/business";
import { generateApiKey, hashApiKey, keyPrefixOf } from "@/lib/integrations/keys";

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

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Default";

    const secret = generateApiKey();
    const keyHash = hashApiKey(secret);

    const created = await prisma.businessApiKey.create({
      data: {
        userId: user.id,
        name,
        keyPrefix: keyPrefixOf(secret),
        keyHash,
      },
    });

    await prisma.campaignIntegration.upsert({
      where: { campaignId },
      create: {
        campaignId,
        userId: user.id,
        apiKeyId: created.id,
        status: "CONFIGURED",
      },
      update: {
        apiKeyId: created.id,
        status: "CONFIGURED",
      },
    });

    return NextResponse.json({
      ok: true,
      apiKey: {
        id: created.id,
        key: secret,
        name: created.name,
        prefix: created.keyPrefix,
        createdAt: created.createdAt,
        revokedAt: created.revokedAt,
      },
      message: "کلید API ساخته شد. این کلید فقط یک بار نمایش داده می‌شود.",
    });
  } catch (error) {
    console.error("Create api key error:", error);
    return NextResponse.json({ error: "خطا در ساخت کلید API." }, { status: 500 });
  }
}
