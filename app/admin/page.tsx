import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { adminNav } from "@/components/dashboard/nav";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { CampaignTable, type CampaignRow } from "@/components/dashboard/campaign-table";
import { ActivityList, type ActivityItem } from "@/components/dashboard/activity-list";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DateRangeSelector } from "@/components/dashboard/date-range";
import { ExportButton } from "@/components/dashboard/export-button";
import {
  IconUsers,
  IconTarget,
  IconStore,
  IconRocket,
  IconCoins,
  IconBank,
} from "@/components/icons";
import {
  parseRange,
  bucketByDay,
  toNumber,
  pctChange,
  splitPeriods,
  formatNumber,
  formatPercent,
  formatRials,
} from "@/lib/stats";
import { campaignStatusLabels } from "@/components/dashboard/status-badge";
import CampaignReviewActions from "./campaign-review-actions";

const DONUT_COLORS = ["#22c55e", "#4ade80", "#86efac", "#7dd3fc", "#fbbf24"];

const roleLabel: Record<string, string> = {
  CREATOR: "خالق محتوا",
  BUSINESS: "کسب‌وکار",
  ADMIN: "مدیر",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const range = parseRange(sp.range);

  const users = await prisma.user.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const creatorsCount = await prisma.creatorProfile.count();
  const businessesCount = await prisma.businessProfile.count();

  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      budget: true,
      spentAmount: true,
      createdAt: true,
      business: { select: { companyName: true } },
      integration: true,
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const conversions = await prisma.conversion.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      amount: true,
      occurredAt: true,
      campaignId: true,
      campaign: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  const clicks = await prisma.click.findMany({
    select: {
      clickedAt: true,
      trackingLink: { select: { campaignId: true } },
    },
    orderBy: { clickedAt: "desc" },
  });

  const withdrawalCounts = await prisma.withdrawal.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amount: true },
  });

  const withdrawals = await prisma.withdrawal.findMany({
    select: {
      id: true,
      amount: true,
      status: true,
      requestedAt: true,
      user: {
        select: {
          name: true,
          phone: true,
          creatorProfile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { requestedAt: "desc" },
    take: 8,
  });

  const recentUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const convRows = conversions.map((c) => ({
    id: c.id,
    amount: toNumber(c.amount),
    occurredAt: c.occurredAt,
    campaignId: c.campaignId,
    campaignName: c.campaign.name,
  }));
  const clickRows = clicks.map((c) => ({
    clickedAt: c.clickedAt,
    campaignId: c.trackingLink.campaignId,
  }));

  const totalUsers = users.length;
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalClicks = clickRows.length;
  const totalConversions = convRows.length;
  const gmv = convRows.reduce((s, c) => s + c.amount, 0);
  const conversionRate =
    totalClicks > 0 ? (totalConversions / totalClicks) * 100 : null;

  const pendingWithdrawals =
    withdrawalCounts
      .filter((w) => w.status === "REQUESTED" || w.status === "PROCESSING")
      .reduce((s, w) => s + w._count._all, 0);
  const totalPaid =
    withdrawalCounts
      .filter((w) => w.status === "COMPLETED")
      .reduce((s, w) => s + toNumber(w._sum.amount), 0);

  const userDelta = pctChange(
    ...(() => {
      const p = splitPeriods(
        users.map((u) => ({ date: u.createdAt, value: 1 })),
        7,
      );
      return [p.current, p.previous] as const;
    })(),
  );
  const gmvDelta = pctChange(
    ...(() => {
      const p = splitPeriods(
        convRows.map((c) => ({ date: c.occurredAt, value: c.amount })),
        7,
      );
      return [p.current, p.previous] as const;
    })(),
  );

  const userSeries = bucketByDay(
    users.map((u) => ({ date: u.createdAt, value: 1 })),
    range,
  );
  const gmvSeries = bucketByDay(
    convRows.map((c) => ({ date: c.occurredAt, value: c.amount })),
    range,
  );
  const convSeries = bucketByDay(
    convRows.map((c) => ({ date: c.occurredAt, value: 1 })),
    range,
  );
  const clickSeries = bucketByDay(
    clickRows.map((c) => ({ date: c.clickedAt, value: 1 })),
    range,
  );
  const chartPoints = gmvSeries.map((p, i) => ({
    label: p.label,
    revenue: p.value,
    conversions: convSeries[i]?.value ?? 0,
    clicks: clickSeries[i]?.value ?? 0,
  }));

  const clicksByCampaign = new Map<string, number>();
  for (const c of clickRows) {
    clicksByCampaign.set(
      c.campaignId,
      (clicksByCampaign.get(c.campaignId) ?? 0) + 1,
    );
  }
  const convsByCampaign = new Map<string, number>();
  const gmvByCampaign = new Map<string, number>();
  for (const c of convRows) {
    convsByCampaign.set(
      c.campaignId,
      (convsByCampaign.get(c.campaignId) ?? 0) + 1,
    );
    gmvByCampaign.set(
      c.campaignId,
      (gmvByCampaign.get(c.campaignId) ?? 0) + c.amount,
    );
  }

  const campaignRows: CampaignRow[] = campaigns.map((campaign) => {
    const campaignId = campaign.id;
    const clicks = clicksByCampaign.get(campaignId) ?? 0;
    const convs = convsByCampaign.get(campaignId) ?? 0;
    return {
      id: campaignId,
      name: campaign.name,
      business: campaign.business.companyName,
      status: campaign.status,
      statusLabel: campaignStatusLabels[campaign.status] ?? campaign.status,
      clicks,
      conversions: convs,
      earnings: toNumber(campaign.spentAmount),
      rate: clicks > 0 ? (convs / clicks) * 100 : null,
    };
  });

  const breakdown = [...gmvByCampaign.entries()]
    .map(([campaignId, value]) => ({
      label: campaigns.find((c) => c.id === campaignId)?.name ?? "کمپین",
      value,
    }))
    .sort((a, b) => b.value - a.value);
  const topBreakdown = breakdown.slice(0, 4).map((b, i) => ({
    ...b,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const restValue = breakdown.slice(4).reduce((s, b) => s + b.value, 0);
  if (restValue > 0) {
    topBreakdown.push({ label: "سایر", value: restValue, color: "#2a332b" });
  }

  const campaignsForReview = campaigns
    .filter((c) => c.status === "PENDING_REVIEW")
    .slice(0, 5);

  const activity: ActivityItem[] = [
    ...campaigns.slice(0, 5).map((c) => ({
      id: "camp-" + c.id,
      kind: "campaign" as const,
      title: "کمپین جدید ایجاد شد",
      description: `${c.name} · ${c.business.companyName}`,
      time: c.createdAt,
    })),
    ...withdrawals.slice(0, 5).map((w) => ({
      id: "wd-" + w.id,
      kind: "withdrawal" as const,
      title: "درخواست برداشت",
      description:
        w.user.creatorProfile?.displayName || w.user.name || w.user.phone || "کاربر",
      amount: {
        text: `- ${formatRials(toNumber(w.amount))}`,
        tone: "neutral" as const,
      },
      time: w.requestedAt,
    })),
    ...recentUsers.map((u) => ({
      id: "user-" + u.id,
      kind: "user" as const,
      title: "کاربر جدید ثبت‌نام کرد",
      description: u.email || u.phone || u.name || "کاربر",
      time: u.createdAt,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 10);

  const exportRows: (string | number)[][] = [
    ["نام کمپین", "کسب‌وکار", "وضعیت", "کلیک‌ها", "تبدیل‌ها", "هزینه (تومان)"],
    ...campaigns.map((c) => [
      c.name,
      c.business.companyName,
      c.status,
      clicksByCampaign.get(c.id) ?? 0,
      convsByCampaign.get(c.id) ?? 0,
      toNumber(c.spentAmount),
    ]),
  ];

  return (
    <DashboardLayout
      sections={adminNav}
      activeHref="/admin"
      user={{ name: "مدیر سیستم", subtitle: "Behrio" }}
      title="داشبورد مدیریت"
      subtitle="نمای کلی پلتفرم، کمپین‌ها و عملیات مالی Behrio."
      actions={
        <>
          <DateRangeSelector defaultRange={range} />
          <ExportButton filename="behrio-admin-campaigns.csv" rows={exportRows} />
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="کاربران کل"
            value={formatNumber(totalUsers)}
            delta={userDelta}
            icon={<IconUsers className="h-4 w-4" />}
            spark={userSeries.map((p) => p.value)}
          />
          <MetricCard
            label="خالقان محتوا"
            value={formatNumber(creatorsCount)}
            delta={null}
            deltaLabel="پروفایل تکمیل‌شده"
            icon={<IconTarget className="h-4 w-4" />}
          />
          <MetricCard
            label="کسب‌وکارها"
            value={formatNumber(businessesCount)}
            delta={null}
            deltaLabel="اعلام‌شده در Behrio"
            icon={<IconStore className="h-4 w-4" />}
          />
          <MetricCard
            label="کمپین‌های فعال"
            value={formatNumber(activeCampaigns)}
            delta={null}
            deltaLabel={`از ${formatNumber(totalCampaigns)} کمپین کل`}
            icon={<IconRocket className="h-4 w-4" />}
          />
          <MetricCard
            label="GMV"
            value={formatRials(gmv)}
            delta={gmvDelta}
            icon={<IconCoins className="h-4 w-4" />}
            spark={gmvSeries.map((p) => p.value)}
            hint={conversionRate !== null ? `نرخ تبدیل ${formatPercent(conversionRate)}` : undefined}
          />
          <MetricCard
            label="برداشت‌های در انتظار"
            value={formatNumber(pendingWithdrawals)}
            delta={null}
            deltaLabel={`کل پرداخت‌شده ${formatRials(totalPaid)}`}
            icon={<IconBank className="h-4 w-4" />}
          />
        </div>

        <PerformanceChart
          points={chartPoints}
          title="فعالیت پلتفرم"
          subtitle="GMV، تبدیل‌ها و کلیک‌ها در طول زمان"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="کمپین‌های در انتظار بررسی"
            subtitle={`${formatNumber(campaignsForReview.length)} مورد نیاز به تأیید`}
          >
            {campaignsForReview.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-subtle">
                کمپینی در انتظار بررسی نیست.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {campaignsForReview.map((campaign) => (
                  <li
                    key={campaign.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-fg">
                          {campaign.name}
                        </span>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-subtle">
                        {campaign.business.companyName} ·{" "}
                        {formatNumber(toNumber(campaign.budget))} تومان ·{" "}
                        {formatNumber(campaign._count.applications)} درخواست
                      </p>
                    </div>
                    <CampaignReviewActions
                      campaignId={campaign.id}
                      canApprove={campaign.integration?.status === "VERIFIED"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="برداشت‌های اخیر"
            subtitle={`${formatNumber(pendingWithdrawals)} مورد در انتظار`}
            actions={
              <a
                href="/admin/withdrawals"
                className="text-xs font-semibold text-primary-soft transition-colors hover:text-primary-bright"
              >
                مشاهده همه
              </a>
            }
          >
            {withdrawals.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-subtle">
                هنوز درخواست برداشتی ثبت نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {withdrawals.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {w.user.creatorProfile?.displayName ||
                          w.user.name ||
                          w.user.phone ||
                          "کاربر"}
                      </p>
                      <p className="tabular text-xs text-subtle">
                        {formatRials(toNumber(w.amount))}
                      </p>
                    </div>
                    <StatusBadge status={w.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="GMV بر اساس کمپین"
            subtitle="توزیع ارزش تبدیل‌های تأییدشده"
          >
            <div className="p-5">
              {topBreakdown.length > 0 ? (
                <DonutChart
                  data={topBreakdown}
                  centerLabel="کل GMV"
                  centerValue={formatCompactRials(gmv)}
                />
              ) : (
                <p className="py-10 text-center text-sm text-subtle">
                  هنوز تبدیلی ثبت نشده است.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="آخرین کاربران"
            subtitle="جدیدترین ثبت‌نام‌ها"
          >
            {recentUsers.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-subtle">
                کاربری ثبت نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {recentUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {u.name || u.email || u.phone || "کاربر بدون مشخصات"}
                      </p>
                      <p
                        dir="ltr"
                        className="truncate text-right text-xs text-subtle"
                      >
                        {u.email || u.phone}
                      </p>
                    </div>
                    {u.role ? (
                      <StatusBadge status={u.role} label={roleLabel[u.role] ?? u.role} />
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-line bg-hover px-2.5 py-0.5 text-xs font-medium text-muted">
                        ناقص
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="آخرین کمپین‌ها"
          subtitle="هزینه و عملکرد به تفکیک کمپین"
          actions={
            <a
              href="/admin/campaigns"
              className="text-xs font-semibold text-primary-soft transition-colors hover:text-primary-bright"
            >
              مشاهده همه
            </a>
          }
        >
          <CampaignTable rows={campaignRows} />
        </SectionCard>

        <SectionCard
          title="فعالیت‌های اخیر"
          subtitle="رویدادهای اخیر پلتفرم"
        >
          <ActivityList items={activity} />
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function formatCompactRials(n: number): string {
  return new Intl.NumberFormat("fa-IR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}