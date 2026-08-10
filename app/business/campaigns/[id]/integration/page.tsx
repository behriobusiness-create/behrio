import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { businessNav } from "@/components/dashboard/nav";
import IntegrationManager from "@/components/integration/integration-manager";

export default async function IntegrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { businessProfile: true },
  });

  if (!fullUser) redirect("/login");
  if (fullUser.role === null) redirect("/onboarding");
  if (fullUser.role !== "BUSINESS") redirectForRole(fullUser.role);
  if (!fullUser.businessProfile) redirect("/onboarding");

  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId: fullUser.businessProfile!.id },
    include: {
      integration: {
        include: {
          apiKey: {
            select: {
              id: true,
              name: true,
              keyPrefix: true,
              createdAt: true,
              lastUsedAt: true,
              revokedAt: true,
              expiresAt: true,
            },
          },
        },
      },
      _count: { select: { trackingLinks: true, conversions: true } },
    },
  });

  if (!campaign) redirect("/business");

  const profile = fullUser.businessProfile!;
  const name = profile.companyName || user.email || "کاربر";

  const integration = campaign.integration
    ? {
        id: campaign.integration.id,
        status: campaign.integration.status,
        verifiedAt: campaign.integration.verifiedAt?.toISOString() ?? null,
        lastVerifiedAt: campaign.integration.lastVerifiedAt?.toISOString() ?? null,
        revokedAt: campaign.integration.revokedAt?.toISOString() ?? null,
        testClickId: campaign.integration.testClickId,
        apiKey: campaign.integration.apiKey
          ? {
              id: campaign.integration.apiKey.id,
              name: campaign.integration.apiKey.name,
              keyPrefix: campaign.integration.apiKey.keyPrefix,
              createdAt: campaign.integration.apiKey.createdAt.toISOString(),
              lastUsedAt: campaign.integration.apiKey.lastUsedAt?.toISOString() ?? null,
              revokedAt: campaign.integration.apiKey.revokedAt?.toISOString() ?? null,
              expiresAt: campaign.integration.apiKey.expiresAt?.toISOString() ?? null,
            }
          : null,
      }
    : null;

  const campaignView = {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    integration,
    _count: campaign._count,
  };

  return (
    <DashboardLayout
      sections={businessNav}
      activeHref="/business"
      user={{
        name,
        subtitle: profile.website || user.email || undefined,
      }}
      title="یکپارچه‌سازی Conversion API"
      subtitle="اتصال کمپین به سیستم شما برای دریافت تبدیل‌ها"
    >
      <IntegrationManager campaign={campaignView} />
    </DashboardLayout>
  );
}
