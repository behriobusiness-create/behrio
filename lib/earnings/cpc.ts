import { prisma } from "@/lib/prisma";

export async function createCpcEarning(
  trackingLinkId: string,
) {
  const trackingLink =
    await prisma.trackingLink.findUnique({
      where: {
        id: trackingLinkId,
      },
      include: {
        campaign: true,
        creator: {
          select: {
            userId: true,
          },
        },
      },
    });


  if (!trackingLink) {
    throw new Error(
      "Tracking link not found",
    );
  }


  if (
    trackingLink.campaign.type !== "CPC"
  ) {
    return null;
  }


  const reward =
    trackingLink.campaign.rewardPerClick;


  if (!reward) {
    throw new Error(
      "CPC reward missing",
    );
  }


  const conversion =
    await prisma.conversion.create({
      data: {
        trackingLinkId:
          trackingLink.id,

        campaignId:
          trackingLink.campaign.id,

        amount: reward,

        status: "APPROVED",

        approvedAt: new Date(),
      },
    });


  const ledger =
    await prisma.ledgerEntry.create({
      data: {
        userId:
          trackingLink.creator.userId,

        campaignId:
          trackingLink.campaign.id,

        conversionId:
          conversion.id,

        type:
          "CREATOR_EARNING",

        status:
          "AVAILABLE",

        amount: reward,

        currency:
          "IRR",

        description:
          "CPC click earning",
      },
    });


  return {
    conversion,
    ledger,
  };
}
