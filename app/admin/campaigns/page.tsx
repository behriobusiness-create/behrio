import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin-shell";
import { Badge, Card } from "@/components/ui";
import {
  IconDashboard,
  IconRocket,
  IconBank,
  IconUsers,
} from "@/components/icons";
import CampaignReviewActions from "../campaign-review-actions";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
];

const statusLabel: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING_REVIEW: "در انتظار بررسی",
  ACTIVE: "فعال",
  PAUSED: "متوقف",
  COMPLETED: "تکمیل شده",
  CANCELLED: "لغو شده",
};

const integrationLabel: Record<string, string> = {
  NOT_CONFIGURED: "یکپارچه‌سازی: تنظیم نشده",
  CONFIGURED: "یکپارچه‌سازی: تنظیم شده",
  VERIFICATION_PENDING: "یکپارچه‌سازی: در انتظار تأیید",
  VERIFIED: "یکپارچه‌سازی: تأیید شده",
  FAILED: "یکپارچه‌سازی: ناموفق",
  DISABLED: "یکپارچه‌سازی: غیرفعال",
};

const integrationTone: Record<string, "default" | "violet" | "green" | "amber" | "blue" | "red"> = {
  NOT_CONFIGURED: "default",
  CONFIGURED: "blue",
  VERIFICATION_PENDING: "amber",
  VERIFIED: "green",
  FAILED: "red",
  DISABLED: "red",
};

const statusTone: Record<string, "default" | "violet" | "green" | "amber" | "blue" | "red"> = {
  DRAFT: "default",
  PENDING_REVIEW: "amber",
  ACTIVE: "green",
  PAUSED: "blue",
  COMPLETED: "default",
  CANCELLED: "red",
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export default async function AdminCampaignsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const campaigns = await prisma.campaign.findMany({
    include: {
      business: { select: { companyName: true } },
      integration: true,
      _count: {
        select: { applications: true, trackingLinks: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = campaigns.filter(
    (c) => c.status === "PENDING_REVIEW"
  ).length;

  return (
    <AdminShell items={nav} activeHref="/admin/campaigns">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">کمپین‌ها</h1>
          <p className="mt-1 text-sm text-muted">
            {pending > 0
              ? `${pending} کمپین در انتظار بررسی.`
              : "کمپینی در انتظار بررسی نیست."}
          </p>
        </div>

        <div className="space-y-3">
          {campaigns.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
              <p className="text-lg font-semibold text-subtle">
                هنوز کمپینی ایجاد نشده است.
              </p>
            </div>
          )}

          {campaigns.map((campaign) => {
            const budget = Number(campaign.budget);
            const spent = Number(campaign.spentAmount);
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

            return (
              <Card key={campaign.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-fg">
                        {campaign.name}
                      </h2>
                      <Badge tone={statusTone[campaign.status] ?? "default"}>
                        {statusLabel[campaign.status] ?? campaign.status}
                      </Badge>
                      <Badge tone={integrationTone[campaign.integration?.status ?? "NOT_CONFIGURED"] ?? "default"}>
                        {integrationLabel[campaign.integration?.status ?? "NOT_CONFIGURED"] ?? campaign.integration?.status}
                      </Badge>
                      <Badge tone="default">{campaign.type}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {campaign.business.companyName}
                    </p>
                    {campaign.description && (
                      <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-muted">
                        {campaign.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
                      <span>
                        بودجه: {formatNumber(budget)} تومان
                      </span>
                      <span>
                        هزینه: {formatNumber(spent)} تومان
                      </span>
                      <span>
                        {campaign._count.applications} درخواست
                      </span>
                      <span>
                        {campaign._count.trackingLinks} لینک پیگیری
                      </span>
                      {campaign.rewardPerClick && (
                        <span>
                          {formatNumber(Number(campaign.rewardPerClick))} تومان / کلیک
                        </span>
                      )}
                      {campaign.rewardPerConversion && (
                        <span>
                          {formatNumber(Number(campaign.rewardPerConversion))} تومان / تبدیل
                        </span>
                      )}
                    </div>
                    <div className="mt-3 max-w-md">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{pct.toFixed(0)}% از بودجه مصرف شده</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-hover">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100 ? "bg-danger" : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {campaign.status === "PENDING_REVIEW" && (
                    <div className="shrink-0">
                      {!campaign.integration ||
                      campaign.integration.status !== "VERIFIED" ? (
                        <p className="max-w-xs rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs leading-5 text-warn">
                          این کمپین تا وقتی یکپارچه‌سازی (Conversion API) تأیید نشود قابل
                          فعال‌سازی نیست.
                        </p>
                      ) : (
                        <CampaignReviewActions
                          campaignId={campaign.id}
                          canApprove={true}
                        />
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
