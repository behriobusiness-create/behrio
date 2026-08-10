import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { creatorNav } from "@/components/dashboard/nav";
import { CampaignGrid, type CampaignView } from "@/components/campaign-grid";
import { toNumber } from "@/lib/stats";

function toView(c: {
  id: string;
  name: string;
  description: string | null;
  type: string;
  accessType: string;
  budget: unknown;
  destinationUrl: string;
  rewardPerClick: unknown;
  rewardPerConversion: unknown;
  rewardPerThousand: unknown;
  commissionPercent: unknown;
  clickRewardPerGroup: unknown;
  business: { companyName: string };
  applications: { status: string }[];
}): CampaignView {
  const app = c.applications[0];
  const raw = app?.status ?? null;
  const applicationStatus =
    raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED"
      ? (raw as CampaignView["applicationStatus"])
      : undefined;
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    type: c.type,
    accessType: c.accessType,
    budget: toNumber(c.budget),
    destinationUrl: c.destinationUrl,
    rewardPerClick: c.rewardPerClick != null ? toNumber(c.rewardPerClick) : null,
    rewardPerConversion:
      c.rewardPerConversion != null ? toNumber(c.rewardPerConversion) : null,
    rewardPerThousand:
      c.rewardPerThousand != null ? toNumber(c.rewardPerThousand) : null,
    commissionPercent:
      c.commissionPercent != null ? toNumber(c.commissionPercent) : null,
    clickRewardPerGroup:
      c.clickRewardPerGroup != null ? toNumber(c.clickRewardPerGroup) : null,
    business: c.business.companyName,
    applicationStatus,
  };
}

export default async function CreatorMarketplacePage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { creatorProfile: true },
  });

  if (!fullUser) redirect("/login");
  if (fullUser.role === null) redirect("/onboarding");
  if (fullUser.role !== "CREATOR") redirectForRole(fullUser.role);
  if (!fullUser.creatorProfile) redirect("/onboarding");

  const creatorId = fullUser.creatorProfile!.id;

  const now = new Date();

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      AND: [
        {
          OR: [{ startAt: null }, { startAt: { lte: now } }],
        },
        {
          OR: [{ endAt: null }, { endAt: { gte: now } }],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      accessType: true,
      budget: true,
      spentAmount: true,
      destinationUrl: true,
      rewardPerClick: true,
      rewardPerConversion: true,
      rewardPerThousand: true,
      commissionPercent: true,
      clickRewardPerGroup: true,
      business: { select: { companyName: true } },
      applications: {
        where: { creatorId },
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const eligibleCampaigns = campaigns.filter(
    (c) => toNumber(c.budget) > toNumber(c.spentAmount),
  );

  const name =
    fullUser.creatorProfile!.displayName || user.email || "کاربر";

  return (
    <DashboardLayout
      sections={creatorNav}
      activeHref="/creator/marketplace"
      user={{
        name,
        subtitle: `@${fullUser.creatorProfile!.instagramHandle || "بدون اینستاگرام"}`,
      }}
      title="بازار کمپین"
      subtitle="کمپین‌های فعال برندها را مرور کنید، جزئیات را بخوانید و برای همکاری درخواست دهید."
    >
      <CampaignGrid campaigns={eligibleCampaigns.map(toView)} />
    </DashboardLayout>
  );
}