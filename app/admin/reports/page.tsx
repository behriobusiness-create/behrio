import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { AdminShell } from "@/components/admin-shell";
import {
  IconActivity,
  IconBank,
  IconDashboard,
  IconPercent,
  IconRocket,
  IconUsers,
} from "@/components/icons";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatNumber, formatRials, toNumber } from "@/lib/stats";
import ReportReviewActions from "@/components/report-review-actions";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "گزارش‌های نمایش", href: "/admin/reports", icon: <IconActivity className="h-5 w-5" /> },
  { label: "کارمزدها", href: "/admin/commissions", icon: <IconPercent className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
];

export default async function AdminReportsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== "ADMIN") redirect("/");

  const [pendingCount, reports] = await Promise.all([
    prisma.campaignReport.count({ where: { status: "PENDING" } }),
    prisma.campaignReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        campaign: {
          select: {
            name: true,
            type: true,
            cpm: true,
            business: { select: { companyName: true } },
          },
        },
        creator: {
          select: { displayName: true, instagramHandle: true },
        },
      },
    }),
  ]);

  return (
    <AdminShell
      items={nav}
      activeHref="/admin/reports"
      title="گزارش‌های نمایش"
      subtitle="بررسی اسکرین‌شات‌های ویو و تأیید پرداخت به خالقان"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-info/25 bg-info/10 p-4">
          <IconActivity className="h-5 w-5 shrink-0 text-info" />
          <p className="text-sm leading-6 text-info/90">
            با تأیید هر گزارش، دستمزد نمایش به خالق پرداخت و از بودجه کمپین کسر
            می‌شود. {formatNumber(pendingCount)} گزارش در انتظار بررسی است.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">گزارش‌های ارسال‌شده</h2>
              <p className="mt-0.5 text-sm text-muted">
                اسکرین‌شات‌های آپلودشده توسط خالقان
              </p>
            </div>
            <Badge tone="amber">{formatNumber(reports.length)} گزارش</Badge>
          </div>

          {reports.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-subtle">
              هنوز گزارشی ثبت نشده است.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {reports.map((report) => {
                const groups = Math.floor(report.claimedImpressions / 1000);
                const cpm = report.campaign.cpm;
                const expectedReward = cpm
                  ? toNumber(cpm) * Math.max(groups, 0)
                  : null;
                return (
                  <li key={report.id} className="px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        {report.screenshotUrl ? (
                          <a
                            href={report.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                          >
                            <Image
                              src={report.screenshotUrl}
                              alt="مدرک نمایش"
                              width={144}
                              height={96}
                              className="h-24 w-36 rounded-xl border border-line object-cover transition-transform hover:scale-[1.02]"
                            />                          </a>
                        ) : (
                          <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-hover text-center text-[11px] leading-4 text-subtle">
                            بدون
                            <br />
                            اسکرین‌شات
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-fg">
                              {report.creator.displayName}
                            </p>
                            <StatusBadge status={report.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-subtle">
                            {report.creator.instagramHandle
                              ? `@${report.creator.instagramHandle}`
                              : "خالق"}
                            {" · "}
                            {report.campaign.business?.companyName || "کسب‌وکار"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-subtle">
                            کمپین: {report.campaign.name}
                          </p>
                          <p className="mt-2 text-[11px] text-subtle">
                            {formatNumber(report.claimedImpressions)} ویو ادعاشده (
                            {formatNumber(groups)} گروه ۱۰۰۰تایی)
                            {report.verifiedImpressions != null && (
                              <span className="ms-2">
                                · {formatNumber(report.verifiedImpressions)} ویو تأییدشده
                              </span>
                            )}
                            {expectedReward !== null && expectedReward > 0 && (
                              <span className="ms-2 font-semibold text-primary-soft">
                                {formatRials(expectedReward)}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-subtle">
                            {new Intl.DateTimeFormat("fa-IR", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(report.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 lg:text-left">
                        <div className="mb-1 text-[11px] text-muted">اقدام مدیر</div>
                        <ReportReviewActions
                          reportId={report.id}
                          status={report.status}
                          claimedImpressions={report.claimedImpressions}
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