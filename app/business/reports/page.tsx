import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { redirect } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui";
import { IconDashboard, IconActivity } from "@/components/icons";
import ReportReviewActions from "@/components/report-review-actions";
import { toNumber } from "@/lib/stats";

const nav = [
  { label: "داشبورد", href: "/business", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "گزارش‌های نمایش", href: "/business/reports", icon: <IconActivity className="h-5 w-5" /> },
];

const statusTone: Record<string, "amber" | "green" | "red" | "default"> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

const statusLabel: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأیید و پرداخت شده",
  REJECTED: "رد شده",
};

export default async function BusinessReportsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { businessProfile: true },
  });

  if (!fullUser) redirect("/login");
  if (fullUser.role === null) redirect("/onboarding");
  if (fullUser.role !== "BUSINESS") redirectForRole(fullUser.role);

  const reports = await prisma.campaignReport.findMany({
    where: { campaign: { businessId: fullUser.businessProfile!.id } },
    include: {
      campaign: { select: { id: true, name: true, type: true, cpm: true } },
      creator: {
        select: {
          displayName: true,
          instagramHandle: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = reports.filter((r) => r.status === "PENDING").length;

  return (
    <DashboardShell
      items={nav}
      activeHref="/business/reports"
      user={{
        name: fullUser.businessProfile!.companyName || "کاربر",
        subtitle: fullUser.businessProfile!.website || "بدون وب‌سایت",
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">گزارش‌های نمایش</h1>
          <p className="mt-1 text-sm text-muted">
            {pending > 0
              ? `${pending} گزارش در انتظار بررسی. پرداخت به ازای هر ۱۰۰۰ نمایش انجام می‌شود.`
              : "گزارشی در انتظار بررسی نیست."}
          </p>
        </div>

        <div className="space-y-4">
          {reports.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
              <p className="text-lg font-semibold text-subtle">
                هنوز گزارش نمایشی ثبت نشده است.
              </p>
            </div>
          )}

          {reports.map((report) => {
            const groups = Math.floor(report.claimedImpressions / 1000);
            const expected =
              report.campaign.cpm && groups > 0 && report.status === "PENDING"
                ? toNumber(report.campaign.cpm) * groups
                : null;

            return (
              <div
                key={report.id}
                className="rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-fg">
                        {report.creator.displayName}
                      </h2>
                      <Badge tone={statusTone[report.status] ?? "default"}>
                        {statusLabel[report.status] ?? report.status}
                      </Badge>
                    </div>
                    {report.creator.instagramHandle && (
                      <p dir="ltr" className="mt-0.5 text-right text-xs text-muted">
                        @{report.creator.instagramHandle}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted">
                      کمپین: <span className="font-semibold">{report.campaign.name}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      نمایش ادعاشده:{" "}
                      <span className="font-semibold">
                        {new Intl.NumberFormat("fa-IR").format(
                          report.claimedImpressions
                        )}{" "}
                        (={new Intl.NumberFormat("fa-IR").format(groups)} گروهِ ۱۰۰۰تایی)
                      </span>
                    </p>
                    {report.verifiedImpressions != null && (
                      <p className="mt-1 text-sm text-muted">
                        نمایش تأییدشده:{" "}
                        <span className="font-semibold">
                          {new Intl.NumberFormat("fa-IR").format(
                            report.verifiedImpressions
                          )}
                        </span>
                      </p>
                    )}
                    {expected !== null && (
                      <p className="mt-1 text-sm text-muted">
                        مبلغ قابل پرداخت:{" "}
                        <span className="font-semibold text-emerald-700">
                          {new Intl.NumberFormat("fa-IR").format(expected)} تومان
                        </span>
                      </p>
                    )}
                    {report.note && (
                      <p className="mt-2 max-w-xl text-xs leading-6 text-muted">
                        {report.note}
                      </p>
                    )}
                    {report.screenshotUrl && (
                      <a
                        href={report.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block"
                      >
                        <Image
                          src={report.screenshotUrl}
                          alt="اسکرین‌شات مدرک نمایش"
                          width={224}
                          height={128}
                          className="h-32 w-56 rounded-xl border border-line object-cover transition-opacity hover:opacity-80"
                        />
                      </a>
                    )}
                  </div>

                  <div className="shrink-0">
                    <ReportReviewActions
                      reportId={report.id}
                      status={report.status}
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