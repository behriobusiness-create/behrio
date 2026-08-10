import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { businessNav } from "@/components/dashboard/nav";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { ActivityList, type ActivityItem } from "@/components/dashboard/activity-list";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DateRangeSelector } from "@/components/dashboard/date-range";
import { ExportButton } from "@/components/dashboard/export-button";
import CreateCampaignForm from "@/components/create-campaign-form";
import { FundCampaignButton } from "@/components/fund-campaign-button";
import { CampaignStatusButton } from "@/components/campaign-status-button";
import { WalletTopUpButton } from "@/components/wallet-topup-button";
import { getBusinessWallet } from "@/lib/wallet";
import {
  IconDollar,
  IconWallet,
  IconMouse,
  IconTarget,
  IconPercent,
  IconCoins,
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
import { getCommissionConfig } from "@/lib/finance/commission";

const DONUT_COLORS = ["#22c55e", "#4ade80", "#86efac", "#7dd3fc", "#fbbf24"];

const typeLabels: Record<string, string> = {
  CPC: "پرداخت به‌ازای کلیک",
  CPA: "پرداخت گروهی به‌ازای کلیک",
  CPM: "پرداخت به‌ازای هزار نمایش",
  AFFILIATE: "همکاری فروش",
  CLIPPING: "کلیپینگ",
};

function typeTone(status: string): string {
  switch (status) {
    case "CPA":
      return "border-primary/25 bg-primary/10 text-primary-soft";
    case "CPC":
      return "border-info/25 bg-info/10 text-info";
    case "CPM":
      return "border-warn/25 bg-warn/10 text-warn";
    case "AFFILIATE":
      return "border-line bg-hover text-muted";
    default:
      return "border-line bg-hover text-muted";
  }
}

function greetingFor(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "صبح بخیر";
  if (hour < 18) return "ظهر بخیر";
  return "شب بخیر";
}

export default async function BusinessDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
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

  const sp = await searchParams;
  const range = parseRange(sp.range);
  const businessId = fullUser.businessProfile!.id;

  const campaigns = await prisma.campaign.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      budget: true,
      spentAmount: true,
      rewardPerClick: true,
      rewardPerConversion: true,
      rewardPerThousand: true,
      commissionPercent: true,
      clickRewardPerGroup: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const conversions = await prisma.conversion.findMany({
    where: { campaign: { businessId }, status: "APPROVED" },
    select: {
      id: true,
      amount: true,
      occurredAt: true,
      campaignId: true,
      campaign: { select: { name: true, status: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  const clicks = await prisma.click.findMany({
    where: { trackingLink: { campaign: { businessId } } },
    select: {
      clickedAt: true,
      trackingLink: { select: { campaignId: true } },
    },
    orderBy: { clickedAt: "desc" },
  });

  const applications = await prisma.campaignApplication.findMany({
    where: { campaign: { businessId } },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      campaign: { select: { id: true, name: true } },
      creator: { select: { displayName: true } },
    },
    orderBy: { appliedAt: "desc" },
    take: 8,
  });

  const pendingApplications = await prisma.campaignApplication.count({
    where: { campaign: { businessId }, status: "PENDING" },
  });

  const pendingReports = await prisma.campaignReport.count({
    where: { campaign: { businessId }, status: "PENDING" },
  });

  const recentReports = await prisma.campaignReport.findMany({
    where: { campaign: { businessId } },
    select: {
      id: true,
      status: true,
      claimedImpressions: true,
      screenshotUrl: true,
      createdAt: true,
      campaign: { select: { id: true, name: true } },
      creator: { select: { displayName: true } },
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

  const totalSpend = campaigns.reduce((s, c) => s + toNumber(c.spentAmount), 0);
  const totalBudget = campaigns.reduce((s, c) => s + toNumber(c.budget), 0);
  const remainingBudget = totalBudget - totalSpend;
  const totalClicks = clickRows.length;
  const totalConversions = convRows.length;
  const conversionRate =
    totalClicks > 0 ? (totalConversions / totalClicks) * 100 : null;
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  const wallet = await getBusinessWallet(prisma, user.id);
  const walletAvailable = toNumber(wallet.available);
  const walletReserved = toNumber(wallet.reserved);
  const walletFunded = toNumber(wallet.funded);

  const spendDelta = pctChange(
    ...(() => {
      const p = splitPeriods(
        convRows.map((c) => ({ date: c.occurredAt, value: c.amount })),
        7,
      );
      return [p.current, p.previous] as const;
    })(),
  );
  const clickDelta = pctChange(
    ...(() => {
      const p = splitPeriods(
        clickRows.map((c) => ({ date: c.clickedAt, value: 1 })),
        7,
      );
      return [p.current, p.previous] as const;
    })(),
  );
  const conversionDelta = pctChange(
    ...(() => {
      const p = splitPeriods(
        convRows.map((c) => ({ date: c.occurredAt, value: 1 })),
        7,
      );
      return [p.current, p.previous] as const;
    })(),
  );

  const spendSeries = bucketByDay(
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
  const chartPoints = spendSeries.map((p, i) => ({
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
  for (const c of convRows) {
    convsByCampaign.set(
      c.campaignId,
      (convsByCampaign.get(c.campaignId) ?? 0) + 1,
    );
  }

  const breakdown = campaigns
    .map((c) => ({
      label: c.name,
      value: toNumber(c.spentAmount),
    }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value);

  const topBreakdown = breakdown.slice(0, 4).map((b, i) => ({
    ...b,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const restValue = breakdown.slice(4).reduce((s, b) => s + b.value, 0);
  if (restValue > 0) {
    topBreakdown.push({ label: "سایر", value: restValue, color: "#2a332b" });
  }

  const activity: ActivityItem[] = [
    ...applications.map((a) => ({
      id: a.id,
      kind: "application" as const,
      title: "درخواست همکاری جدید",
      description: `${a.creator.displayName} · ${a.campaign.name}`,
      amount: { text: "در انتظار", tone: "neutral" as const },
      time: a.appliedAt,
    })),
    ...convRows.slice(0, 6).map((c) => ({
      id: "conv-" + c.id,
      kind: "conversion" as const,
      title: "تبدیل تأیید شد",
      description: c.campaignName,
      amount: {
        text: `${formatRials(c.amount)}`,
        tone: "neutral" as const,
      },
      time: c.occurredAt,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 10);

  const profile = fullUser.businessProfile!;
  const name = profile.companyName || user.email || "کاربر";

  const exportRows: (string | number)[][] = [
    ["نام کمپین", "وضعیت", "نوع", "کلیک‌ها", "تبدیل‌ها", "هزینه (تومان)", "بودجه (تومان)"],
    ...campaigns.map((c) => [
      c.name,
      c.status,
      typeLabels[c.type] ?? c.type,
      clicksByCampaign.get(c.id) ?? 0,
      convsByCampaign.get(c.id) ?? 0,
      toNumber(c.spentAmount),
      toNumber(c.budget),
    ]),
  ];

  return (
    <DashboardLayout
      sections={businessNav}
      activeHref="/business"
      user={{
        name,
        subtitle: profile.website || user.email || undefined,
      }}
      title={`${greetingFor()}، ${name}`}
      subtitle="نمای کلی هزینه و عملکرد کمپین‌های شما در Behrio."
      actions={
        <>
          <DateRangeSelector defaultRange={range} />
          <ExportButton filename="behrio-campaigns.csv" rows={exportRows} />
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="کل هزینه"
            value={formatRials(totalSpend)}
            delta={spendDelta}
            icon={<IconDollar className="h-4 w-4" />}
            spark={spendSeries.map((p) => p.value)}
          />
          <MetricCard
            label="بودجه باقی‌مانده"
            value={formatRials(remainingBudget)}
            delta={null}
            deltaLabel="از کل بودجه کمپین‌ها"
            icon={<IconWallet className="h-4 w-4" />}
            hint={totalBudget > 0 ? `${formatPercent((totalSpend / totalBudget) * 100, 1)} مصرف شده` : undefined}
          />
          <MetricCard
            label="کلیک‌ها"
            value={formatNumber(totalClicks)}
            delta={clickDelta}
            icon={<IconMouse className="h-4 w-4" />}
            spark={clickSeries.map((p) => p.value)}
          />
          <MetricCard
            label="تبدیل‌ها"
            value={formatNumber(totalConversions)}
            delta={conversionDelta}
            icon={<IconTarget className="h-4 w-4" />}
            spark={convSeries.map((p) => p.value)}
          />
          <MetricCard
            label="نرخ تبدیل"
            value={conversionRate === null ? "—" : formatPercent(conversionRate)}
            delta={null}
            deltaLabel="از کل کلیک‌ها"
            icon={<IconPercent className="h-4 w-4" />}
          />
          <MetricCard
            label="میانگین هزینه / تبدیل"
            value={avgCpa > 0 ? formatRials(avgCpa) : "—"}
            delta={null}
            deltaLabel="CPA میانگین"
            icon={<IconCoins className="h-4 w-4" />}
          />
        </div>

        <PerformanceChart
          points={chartPoints}
          title="نمای عملکرد"
          subtitle="هزینه‌ها و تبدیل‌ها در طول زمان"
        />

        <SectionCard
          title="کیف پول"
          subtitle="موجودی برای ساخت و شارژ کمپین‌ها"
          actions={<WalletTopUpButton />}
        >
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-muted">موجودی قابل استفاده</p>
              <p className="mt-2 tabular text-2xl font-bold text-primary-soft">
                {formatRials(walletAvailable)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-muted">رزرو شده در کمپین‌ها</p>
              <p className="mt-2 tabular text-2xl font-bold text-fg">
                {formatRials(walletReserved)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-muted">مجموع شارژ شده</p>
              <p className="mt-2 tabular text-2xl font-bold text-fg">
                {formatRials(walletFunded)}
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="flex items-start gap-3 rounded-2xl border border-info/25 bg-info/10 p-4">
          <IconPercent className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <div className="text-sm leading-6 text-info/90">
            <p className="font-semibold text-info">کارمزد پلتفرم</p>
            <p>
              به‌ازای هر کمپین پس از پایان و تسویه،{" "}
              {formatNumber(getCommissionConfig().businessRate.toNumber())}٪ از هزینه نهایی
              (مبلغ واقعی مصرف‌شده، نه کل بودجه) به‌عنوان کارمزد پلتفرم کسر
              می‌شود. این مبلغ فقط برای کمپین‌های تکمیل‌شده اعمال می‌شود.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="تفکیک هزینه"
            subtitle="توزیع هزینه بر اساس کمپین"
          >
            <div className="p-5">
              {topBreakdown.length > 0 ? (
                <DonutChart
                  data={topBreakdown}
                  centerLabel="کل هزینه"
                  centerValue={formatCompactRials(totalSpend)}
                />
              ) : (
                <p className="py-10 text-center text-sm text-subtle">
                  هنوز هزینه‌ای ثبت نشده است.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="کمپین‌های من"
            subtitle={`${formatNumber(campaigns.length)} کمپین · ${formatNumber(activeCampaigns)} فعال`}
            actions={
              <div className="flex flex-wrap gap-2">
                {pendingReports > 0 && (
                  <a
                    href="/business/reports"
                    className="inline-flex items-center rounded-full border border-info/25 bg-info/10 px-3 py-1 text-xs font-semibold text-info transition-colors hover:bg-info/20"
                  >
                    {formatNumber(pendingReports)} گزارش نمایش در انتظار
                  </a>
                )}
                {pendingApplications > 0 ? (
                  <a
                    href="/business/applications"
                    className="inline-flex items-center rounded-full border border-warn/25 bg-warn/10 px-3 py-1 text-xs font-semibold text-warn transition-colors hover:bg-warn/20"
                  >
                    {formatNumber(pendingApplications)} درخواست جدید
                  </a>
                ) : undefined}
              </div>
            }
          >
            <ul className="divide-y divide-line/60">
              {campaigns.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-subtle">
                  هنوز کمپینی ایجاد نکرده‌اید.
                </li>
              )}
              {campaigns.map((campaign) => {
                const budget = toNumber(campaign.budget);
                const spentAmt = toNumber(campaign.spentAmount);
                const pct = budget > 0 ? Math.min(100, (spentAmt / budget) * 100) : 0;
                const convs = convsByCampaign.get(campaign.id) ?? 0;
                const cpa = convs > 0 ? spentAmt / convs : null;
                return (
                  <li key={campaign.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-fg">
                            {campaign.name}
                          </span>
                          <StatusBadge status={campaign.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${typeTone(campaign.type)}`}
                          >
                            {typeLabels[campaign.type] ?? campaign.type}
                          </span>
                          <span>{formatNumber(campaign._count.applications)} درخواست</span>
                          {(campaign.type === "CPC" || campaign.type === "CPA") &&
                            campaign.rewardPerClick && (
                              <span>
                                {formatRials(toNumber(campaign.rewardPerClick))} /{" "}
                                {formatNumber(toNumber(campaign.clickRewardPerGroup ?? 1))} کلیک
                              </span>
                            )}
                          {(campaign.type === "CPM" || campaign.type === "CLIPPING") &&
                            campaign.rewardPerThousand && (
                              <span>{formatRials(toNumber(campaign.rewardPerThousand))} / هزار نمایش</span>
                            )}
                          {campaign.type === "AFFILIATE" && (
                            <span>
                              {campaign.commissionPercent
                                ? `${formatNumber(toNumber(campaign.commissionPercent))}٪ کمیسیون / فروش`
                                : `${formatRials(toNumber(campaign.rewardPerConversion ?? 0))} کمیسیون / فروش`}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <FundCampaignButton
                            campaignId={campaign.id}
                            campaignName={campaign.name}
                          />
                          <CampaignStatusButton
                            campaignId={campaign.id}
                            status={campaign.status}
                          />
                          <a
                            href={`/business/campaigns/${campaign.id}/integration`}
                            className="inline-flex items-center rounded-lg border border-line bg-hover px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-fg"
                          >
                            یکپارچه‌سازی
                          </a>
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="tabular text-sm font-semibold text-fg">
                          {formatRials(spentAmt)}
                        </p>
                        <p className="text-[11px] text-subtle">
                          {cpa !== null ? `${formatRials(cpa)} / تبدیل` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100
                              ? "bg-danger"
                              : pct >= 80
                                ? "bg-warn"
                                : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="tabular text-[11px] text-subtle">
                        {formatPercent(pct, 0)} از بودجه
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          title="درخواست‌های همکاری"
          subtitle="جدیدترین درخواست‌های خالقان برای کمپین‌های شما"
          actions={
            <a
              href="/business/applications"
              className="inline-flex items-center rounded-lg border border-line bg-hover px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:bg-surface"
            >
              مشاهده همه درخواست‌ها
            </a>
          }
        >
          {applications.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-subtle">
              هنوز درخواست همکاری ندارید.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {applications.map((app) => (
                <li key={app.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">
                        {app.creator.displayName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {app.campaign.name}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="گزارش‌های نمایش"
          subtitle="اسکرین‌شات‌های آپلودشده توسط خالقان برای تأیید ویوها"
          actions={
            <a
              href="/business/reports"
              className="inline-flex items-center rounded-lg border border-line bg-hover px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:bg-surface"
            >
              مشاهده همه گزارش‌ها
            </a>
          }
        >
          {recentReports.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-subtle">
              هنوز گزارشی از خالقان ثبت نشده است.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {recentReports.map((report) => {
                const groups = Math.floor(report.claimedImpressions / 1000);
                return (
                  <li key={report.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {report.screenshotUrl ? (
                          <a
                            href={report.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                          >
                            <img
                              src={report.screenshotUrl}
                              alt="مدرک نمایش"
                              className="h-20 w-28 rounded-lg border border-line object-cover"
                            />
                          </a>
                        ) : (
                          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-hover text-center text-[10px] leading-4 text-subtle">
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
                            {report.campaign.name}
                          </p>
                          <p className="mt-1 text-[11px] text-subtle">
                            {formatNumber(report.claimedImpressions)} ویو (
                            {formatNumber(groups)} گروه ۱۰۰۰تایی)
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-[11px] text-subtle">
                        {new Intl.DateTimeFormat("fa-IR", {
                          dateStyle: "medium",
                        }).format(report.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="کمپین جدید"
            subtitle="کمپین‌ها قبل از انتشار نیاز به تأیید مدیر دارند."
          >
            <div className="p-5">
              <CreateCampaignForm />
            </div>
          </SectionCard>

          <SectionCard
            title="فعالیت‌های اخیر"
            subtitle="آخرین درخواست‌ها و تبدیل‌های کمپین"
          >
            <ActivityList items={activity} />
          </SectionCard>
        </div>
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