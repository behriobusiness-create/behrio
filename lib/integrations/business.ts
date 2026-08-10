import { prisma } from "@/lib/prisma";

export async function getBusinessProfileForUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      businessProfile: { select: { id: true, companyName: true } },
    },
  });
}

export async function findCampaignOwnedByBusiness(campaignId: string, businessProfileId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, businessId: businessProfileId },
    include: {
      business: { select: { userId: true, companyName: true } },
    },
  });
}

export async function getIntegrationWithApiKey(campaignId: string) {
  const integration = await prisma.campaignIntegration.findUnique({
    where: { campaignId },
    include: {
      apiKey: {
        select: {
          id: true,
          keyPrefix: true,
          revokedAt: true,
          expiresAt: true,
          createdAt: true,
          lastUsedAt: true,
        },
      },
    },
  });
  return integration;
}
