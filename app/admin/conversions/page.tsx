import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { AdminShell } from "@/components/admin-shell";
import {
  IconActivity,
  IconBank,
  IconChart,
  IconDashboard,
  IconPercent,
  IconRocket,
  IconUsers,
} from "@/components/icons";
import { toNumber } from "@/lib/stats";
import ConversionReviewActions from "@/components/conversion-review-actions";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "تبدیل‌ها", href: "/admin/conversions", icon: <IconChart className="h-5 w-5" /> },
  { label: "گزارش‌های نمایش", href: "/admin/reports", icon: <IconActivity className="h-5 w-5" /> },
  { label: "کارمزدها", href: "/admin/commissions", icon: <IconPercent className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
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
  MANUAL: "دستی",
  INTEGRATION: "API",
  POSTBACK: "ریدایرکت",
};

export default async function AdminConversionsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== "ADMIN") redirect("/");

  const [pendingCount, conversions] = await Promise.all([
    prisma.conversion.count({ where: { status: "PENDING" } }),
    prisma.conversion.findMany({
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        campaign: {
          select: {
            name: true,
            type: true,
            business: { select: { companyName: true } },
          },
        },
        trackingLink: {
          select: {
            creator: { select: { displayName: true, instagramHandle: true } },
          },
        },
      },
    }),
  ]);

  return (
    <AdminShell
      items={nav}
      activeHref="/admin/conversions"
      title="تبدیل‌ها"
      subtitle="سوابق فروش‌های ثبت‌شده (ریدایرکت یا API)"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-info/25 bg-info/10 p-4">
          <IconChart className="h-5 w-5 shrink-0 text-info" />
          <p className="text-sm leading-6 text-info/90">
            کمپین‌ها صرفاً بر اساس نمایش (CPM) پرداخت می‌شوند؛ تبدیل فروش درآمدی
            برای خالق ایجاد نمی‌کند و صرفاً برای سوابق ثبت می‌شود.{" "}
            {pendingCount} تبدیل در انتظار بررسی است.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">فهرست تبدیل‌ها</h2>
              <p className="mt-0.5 text-sm text-muted">
                همه تبدیل‌های ثبت‌شده در کمپین‌ها
              </p>
            </div>
            <Badge tone="amber">{conversions.length} تبدیل</Badge>
          </div>

          {conversions.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-subtle">
              هنوز تبدیلی ثبت نشده است.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {conversions.map((conversion) => {
                const amount = toNumber(conversion.amount ?? 0);
                const cmp = conversion.campaign;
                return (
                  <li key={conversion.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-fg">
                            {conversion.trackingLink.creator.displayName}
                          </p>
                          <Badge tone={statusTone[conversion.status] ?? "default"}>
                            {statusLabel[conversion.status] ?? conversion.status}
                          </Badge>
                          <Badge tone="default">
                            {sourceLabel[conversion.source ?? "MANUAL"] ??
                              conversion.source}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-subtle">
                          {conversion.trackingLink.creator.instagramHandle
                            ? `@${conversion.trackingLink.creator.instagramHandle}`
                            : "خالق"}
                          {" · "}
                          {cmp.business?.companyName || "کسب‌وکار"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-subtle">
                          کمپین: {cmp.name}
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">
                          سفارش:{" "}
                          <span dir="ltr" className="font-mono">
                            {conversion.externalOrderId ?? "—"}
                          </span>{" "}
                          · فروش: {amount.toLocaleString("fa-IR")} ریال
                        </p>
                        <p className="mt-0.5 text-[11px] text-subtle">
                          {new Intl.DateTimeFormat("fa-IR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(conversion.occurredAt)}
                        </p>
                      </div>

                      <div className="shrink-0 lg:text-left">
                        <div className="mb-1 text-[11px] text-muted">
                          اقدام مدیر
                        </div>
                        <ConversionReviewActions
                          conversionId={conversion.id}
                          status={conversion.status}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
