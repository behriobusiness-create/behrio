import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui";
import { IconDashboard, IconActivity, IconChart } from "@/components/icons";
import ConversionReviewActions from "@/components/conversion-review-actions";
import { toNumber } from "@/lib/stats";

const nav = [
  { label: "داشبورد", href: "/business", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "تبدیل‌ها", href: "/business/conversions", icon: <IconChart className="h-5 w-5" /> },
  { label: "گزارش‌های نمایش", href: "/business/reports", icon: <IconActivity className="h-5 w-5" /> },
];

const statusTone: Record<string, "amber" | "green" | "red" | "default"> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  REVERSED: "red",
};

const statusLabel: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأیید و پرداخت شده",
  REJECTED: "رد شده",
  REVERSED: "برگشت داده شده",
};

const sourceLabel: Record<string, string> = {
  MANUAL: "ثبت دستی خالق",
  INTEGRATION: "API فروشگاه",
  POSTBACK: "ریدایرکت بدون کد",
};

export default async function BusinessConversionsPage() {
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

  const conversions = await prisma.conversion.findMany({
    where: { campaign: { businessId: fullUser.businessProfile.id } },
    include: {
      campaign: {
        select: {
          name: true,
          type: true,
          rewardPerConversion: true,
          commissionPercent: true,
        },
      },
      trackingLink: {
        select: {
          creator: {
            select: { displayName: true, instagramHandle: true },
          },
        },
      },
    },
    orderBy: { occurredAt: "desc" },
  });

  const pending = conversions.filter((c) => c.status === "PENDING").length;

  return (
    <DashboardShell
      items={nav}
      activeHref="/business/conversions"
      user={{
        name: fullUser.businessProfile.companyName || "کاربر",
        subtitle: fullUser.businessProfile.website || "بدون وب‌سایت",
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">تبدیل‌ها</h1>
          <p className="mt-1 text-sm text-muted">
            {pending > 0
              ? `${pending} تبدیل در انتظار بررسی. با تأیید، دستمزد به خالق پرداخت می‌شود.`
              : "تبدیلی در انتظار بررسی نیست."}
          </p>
        </div>

        <div className="space-y-4">
          {conversions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
              <p className="text-lg font-semibold text-subtle">
                هنوز تبدیلی ثبت نشده است.
              </p>
            </div>
          )}

          {conversions.map((conversion) => {
            const amount = toNumber(conversion.amount ?? 0);
            const cmp = conversion.campaign;
            const reward =
              cmp.type === "AFFILIATE" && cmp.commissionPercent
                ? amount * toNumber(cmp.commissionPercent) / 100
                : toNumber(cmp.rewardPerConversion ?? 0);
            const rewardText =
              conversion.status === "PENDING" && reward > 0
                ? reward
                : null;

            return (
              <div
                key={conversion.id}
                className="rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-fg">
                        {conversion.trackingLink.creator.displayName}
                      </h2>
                      <Badge tone={statusTone[conversion.status] ?? "default"}>
                        {statusLabel[conversion.status] ?? conversion.status}
                      </Badge>
                      <Badge tone="default">
                        {sourceLabel[conversion.source ?? "MANUAL"] ??
                          conversion.source}
                      </Badge>
                    </div>
                    {conversion.trackingLink.creator.instagramHandle && (
                      <p
                        dir="ltr"
                        className="mt-0.5 text-right text-xs text-muted"
                      >
                        @{conversion.trackingLink.creator.instagramHandle}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted">
                      کمپین:{" "}
                      <span className="font-semibold">{cmp.name}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      شماره سفارش:{" "}
                      <span
                        dir="ltr"
                        className="font-mono font-semibold"
                      >
                        {conversion.externalOrderId ?? "—"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      مبلغ فروش:{" "}
                      <span className="font-semibold">{amount.toLocaleString("fa-IR")} ریال</span>
                      {rewardText !== null && rewardText > 0 && (
                        <span className="ms-2 font-semibold text-emerald-700">
                          دستمزد خالق: {rewardText.toLocaleString("fa-IR")} ریال
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {new Intl.DateTimeFormat("fa-IR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(conversion.occurredAt)}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <ConversionReviewActions
                      conversionId={conversion.id}
                      status={conversion.status}
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
