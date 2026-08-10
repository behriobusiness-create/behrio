import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui";
import { IconDashboard, IconUsers } from "@/components/icons";
import ReviewActions from "@/components/review-actions";

const nav = [
  { label: "داشبورد", href: "/business", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "درخواست‌ها", href: "/business/applications", icon: <IconUsers className="h-5 w-5" /> },
];

const statusTone: Record<string, "amber" | "green" | "red" | "default"> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  WITHDRAWN: "default",
};

const statusLabel: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  WITHDRAWN: "انصراف داده",
};

export default async function BusinessApplicationsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { businessProfile: true },
  });

  if (!fullUser) redirect("/login");
  if (fullUser.role === null) redirect("/onboarding");
  if (fullUser.role !== "BUSINESS") redirectForRole(fullUser.role);

  const applications = await prisma.campaignApplication.findMany({
    where: { campaign: { businessId: fullUser.businessProfile!.id } },
    include: {
      campaign: { select: { id: true, name: true } },
      creator: {
        select: {
          id: true,
          displayName: true,
          instagramHandle: true,
          bio: true,
        },
      },
    },
    orderBy: { appliedAt: "desc" },
  });

  const trackingLinks = await prisma.trackingLink.findMany({
    where: {
      campaign: { businessId: fullUser.businessProfile!.id },
    },
    select: {
      campaignId: true,
      creatorId: true,
      code: true,
    },
  });

  const linkByKey = new Map(
    trackingLinks.map((l) => [`${l.campaignId}:${l.creatorId}`, l.code])
  );

  const pending = applications.filter((a) => a.status === "PENDING").length;

  return (
    <DashboardShell
      items={nav}
      activeHref="/business/applications"
      user={{
        name: fullUser.businessProfile!.companyName || "کاربر",
        subtitle: fullUser.businessProfile!.website || "بدون وب‌سایت",
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            درخواست‌های همکاری
          </h1>
          <p className="mt-1 text-sm text-muted">
            {pending > 0
              ? `${pending} درخواست در انتظار بررسی.`
              : "درخواستی در انتظار بررسی نیست."}
          </p>
        </div>

        <div className="space-y-4">
          {applications.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
              <p className="text-lg font-semibold text-subtle">
                هنوز درخواست همکاری وجود ندارد.
              </p>
            </div>
          )}

          {applications.map((app) => {
            const link = linkByKey.get(`${app.campaignId}:${app.creatorId}`) ?? null;

            return (
              <div
                key={app.id}
                className="rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-fg">
                        {app.creator.displayName}
                      </h2>
                      <Badge tone={statusTone[app.status] ?? "default"}>
                        {statusLabel[app.status] ?? app.status}
                      </Badge>
                    </div>
                    {app.creator.instagramHandle && (
                      <p dir="ltr" className="mt-0.5 text-right text-xs text-muted">
                        @{app.creator.instagramHandle}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted">
                      کمپین: <span className="font-semibold">{app.campaign.name}</span>
                    </p>
                    {app.creator.bio && (
                      <p className="mt-1 max-w-xl text-xs leading-6 text-muted">
                        {app.creator.bio}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <ReviewActions
                      applicationId={app.id}
                      status={app.status}
                      trackingLink={link}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
