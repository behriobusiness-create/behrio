import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { creatorNav } from "@/components/dashboard/nav";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { ConversionPerformance } from "@/components/dashboard/conversion-performance";
import { CampaignTable, type CampaignRow } from "@/components/dashboard/campaign-table";
import { ActivityList, type ActivityItem } from "@/components/dashboard/activity-list";
import { SectionCard } from "@/components/dashboard/section-card";
import { DateRangeSelector } from "@/components/dashboard/date-range";
import { ExportButton } from "@/components/dashboard/export-button";
import { getAvailableBalance } from "@/lib/wallet";
import { TrackingLinkBox } from "@/components/tracking-link-box";
import { SubmitConversionButton } from "@/components/submit-conversion-button";
import { SubmitReportButton } from "@/components/submit-report-button";
import {
  IconWallet,
  IconCoins,
  IconMousePointer,
  IconTarget,
  IconPercent,
  IconRocket,
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
  type DatedRow,
} from "@/lib/stats";
import { campaignStatusLabels } from "@/components/dashboard/status-badge";

const DONUT_COLORS = ["#22c55e", "#4ade80", "#86efac", "#7dd3fc", "#a1aaa3"];

function greetingFor(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "صبح بخیر";
  if (hour < 18) return "ظهر بخیر";
  return "شب بخیر";
}

function toDated(rows: { createdAt: Date; amount: number }[]): DatedRow[] {
  return rows.map((r) => ({ date: r.createdAt, value: r.amount }));
}

export default async function CreatorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
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

  const sp = await searchParams;
  const range = parseRange(sp.range);
  const creatorId = fullUser.creatorProfile!.id;

  const ledger = await prisma.ledgerEntry.findMany({
    where: { userId: user.id, type: "CREATOR_EARNING", status: "AVAILABLE" },
    select: { id: true, amount: true, createdAt: true, campaignId: true },
    orderBy: { createdAt: "desc" },
  });
  const conversions = await prisma.conversion.findMany({
    where: { trackingLink: { creatorId }, status: "APPROVED" },
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
    where: { trackingLink: { creatorId } },
    select: {
      clickedAt: true,
      trackingLink: { select: { campaignId: true } },
    },
    orderBy: { clickedAt: "desc" },
  });
  const approved = await prisma.campaignApplication.findMany({
    where: { creatorId, status: "APPROVED" },
    select: {
      id: true,
      campaign: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          rewardPerConversion: true,
          rewardPerThousand: true,
          rewardPerClick: true,
          business: { select: { companyName: true } },
        },
      },
    },
  });
  const recentWithdrawals = await prisma.withdrawal.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 8,
  });
  const balance = await getAvailableBalance(prisma, user.id);

  const trackingLinks = await prisma.trackingLink.findMany({
    where: { creatorId },
    select: { campaignId: true, code: true, status: true },
  });
  const trackingByCampaign = new Map(
    trackingLinks.map((t) => [t.campaignId, t.code]),
  );

  const linkCampaigns = approved
    .filter((a) => a.campaign.status === "ACTIVE")
    .map((a) => ({
      id: a.campaign.id,
      name: a.campaign.name,
      type: a.campaign.type,
      business: a.campaign.business.companyName,
      code: trackingByCampaign.get(a.campaign.id) ?? null,
    }));

  const ledgerRows = ledger.map((l) => ({
    amount: toNumber(l.amount),
    createdAt: l.createdAt,
    campaignId: l.campaignId,
  }));
  const convRows = conversions.map((c) => ({
    amount: toNumber(c.amount),
    occurredAt: c.occurredAt,
    campaignId: c.campaignId,
  }));
  const clickRows = clicks.map((c) => ({
    clickedAt: c.clickedAt,
    campaignId: c.trackingLink.campaignId,
  }));

  const totalEarned = ledgerRows.reduce((s, r) => s + r.amount, 0);
  const totalClicks = clickRows.length;
  const totalConversions = convRows.length;
  const conversionRate =
    totalClicks > 0 ? (totalConversions / totalClicks) * 100 : null;
  const avgValue = totalConversions > 0 ? totalEarned / totalConversions : 0;
  const activeCampaigns = approved.filter(
    (a) => a.campaign.status === "ACTIVE",
  ).length;

  const earningDelta = pctChange(
    ...(() => {
      const p = splitPeriods(toDated(ledgerRows), 7);
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

  const revSeries = bucketByDay(toDated(ledgerRows), range);
  const convSeries = bucketByDay(
    convRows.map((c) => ({ date: c.occurredAt, value: 1 })),
    range,
  );
  const clickSeries = bucketByDay(
    clickRows.map((c) => ({ date: c.clickedAt, value: 1 })),
    range,
  );
  const chartPoints = revSeries.map((p, i) => ({
    label: p.label,
    revenue: p.value,
    conversions: convSeries[i]?.value ?? 0,
    clicks: clickSeries[i]?.value ?? 0,
  }));

  const earningsByCampaign = new Map<string, number>();
  for (const r of ledgerRows) {
    if (r.campaignId) {
      earningsByCampaign.set(
        r.campaignId,
        (earningsByCampaign.get(r.campaignId) ?? 0) + r.amount,
      );
    }
  }
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

  const breakdown = [...earningsByCampaign.entries()]
    .map(([campaignId, value]) => ({ campaignId, value }))
    .sort((a, b) => b.value - a.value);

  const campaignName = new Map<string, string>();
  for (const a of approved) campaignName.set(a.campaign.id, a.campaign.name);

  const topBreakdown = breakdown.slice(0, 4).map((b, i) => ({
    label: campaignName.get(b.campaignId) ?? "کمپین",
    value: b.value,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const restValue = breakdown.slice(4).reduce((s, b) => s + b.value, 0);
  if (restValue > 0) {
    topBreakdown.push({
      label: "سایر",
      value: restValue,
      color: "#2a332b",
    });
  }

  const campaignRows: CampaignRow[] = approved.map((app) => {
    const campaignId = app.campaign.id;
    const clicks = clicksByCampaign.get(campaignId) ?? 0;
    const convs = convsByCampaign.get(campaignId) ?? 0;
    const earnings = earningsByCampaign.get(campaignId) ?? 0;
    return {
      id: app.id,
      name: app.campaign.name,
      business: app.campaign.business.companyName,
      status: app.campaign.status,
      statusLabel: campaignStatusLabels[app.campaign.status] ?? app.campaign.status,
      clicks,
      conversions: convs,
      earnings,
      rate: clicks > 0 ? (convs / clicks) * 100 : null,
    };
  });

  const referralCampaigns = approved
    .filter((a) => a.campaign.type === "AFFILIATE")
    .map((a) => {
      const campaignId = a.campaign.id;
      const clicks = clicksByCampaign.get(campaignId) ?? 0;
      const convs = convsByCampaign.get(campaignId) ?? 0;
      return {
        id: a.id,
        campaignId: a.campaign.id,
        name: a.campaign.name,
        business: a.campaign.business.companyName,
        status: a.campaign.status,
        commission: a.campaign.rewardPerConversion,
        clicks,
        conversions: convs,
        earnings: earningsByCampaign.get(campaignId) ?? 0,
      };
    });

  const cpmCampaigns = approved
    .filter(
      (a) => a.campaign.type === "CPM" || a.campaign.type === "CLIPPING",
    )
    .map((a) => {
      const campaignId = a.campaign.id;
      const clicks = clicksByCampaign.get(campaignId) ?? 0;
      const convs = convsByCampaign.get(campaignId) ?? 0;
      return {
        id: a.id,
        campaignId: a.campaign.id,
        name: a.campaign.name,
        business: a.campaign.business.companyName,
        status: a.campaign.status,
        ratePerThousand: a.campaign.rewardPerThousand,
        clicks,
        conversions: convs,
        earnings: earningsByCampaign.get(campaignId) ?? 0,
      };
    });

  const reportCampaigns: {
    id: string;
    name: string;
    ratePerThousand: number | null;
  }[] = approved
    .filter(
      (a) =>
        a.campaign.status === "ACTIVE" &&
        (a.campaign.type === "CPM" || a.campaign.type === "CLIPPING") &&
        a.campaign.rewardPerThousand != null,
    )
    .map((a) => ({
      id: a.campaign.id,
      name: a.campaign.name,
      ratePerThousand: toNumber(a.campaign.rewardPerThousand),
    }));

  const activity: ActivityItem[] = [
    ...ledger.slice(0, 5).map((l) => ({
      id: l.id,
      kind: "earning" as const,
      title: "درآمد کمپین اضافه شد",
      description: campaignName.get(l.campaignId ?? "") ?? "کمپین",
      amount: { text: `+ ${formatRials(toNumber(l.amount))}`, tone: "pos" as const },
      time: l.createdAt,
    })),
    ...recentWithdrawals.map((w) => ({
      id: w.id,
      kind: "withdrawal" as const,
      title: "برداشت",
      description: campaignStatusLabels[w.status] ?? w.status,
      amount: {
        text: `- ${formatRials(toNumber(w.amount))}`,
        tone: "neutral" as const,
      },
      time: w.requestedAt,
    })),
    ...conversions.slice(0, 5).map((c) => ({
      id: c.id,
      kind: "conversion" as const,
      title: "تبدیل تأیید شد",
      description: c.campaign.name,
      amount: {
        text: `+ ${formatRials(toNumber(c.amount))}`,
        tone: "pos" as const,
      },
      time: c.occurredAt,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 10);

  const profile = fullUser.creatorProfile!;
  const name = profile.displayName || user.email || "کاربر";
  const exportRows: (string | number)[][] = [
    ["کمپین", "کسب‌وکار", "وضعیت", "کلیک‌ها", "تبدیل‌ها", "درآمد", "نرخ تبدیل"],
    ...campaignRows.map((r) => [
      r.name,
      r.business ?? "",
      r.statusLabel ?? r.status,
      r.clicks,
      r.conversions,
      r.earnings,
      r.rate === null ? "" : `${r.rate.toFixed(1)}%`,
    ]),
  ];

  return (
    <DashboardLayout
      sections={creatorNav}
      activeHref="/creator"
      user={{
        name,
        subtitle: profile.instagramHandle
          ? `@${profile.instagramHandle}`
          : user.email ?? undefined,
      }}
      title={`${greetingFor()}، ${name}`}
      subtitle="نمای کلی عملکرد و درآمد شما در Behrio."
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
            label="کل درآمد"
            value={formatRials(totalEarned)}
            delta={earningDelta}
            icon={<IconCoins className="h-4 w-4" />}
            spark={revSeries.map((p) => p.value)}
          />
          <MetricCard
            label="موجودی قابل برداشت"
            value={formatRials(balance.toNumber())}
            delta={null}
            deltaLabel="موجودی نقدی"
            icon={<IconWallet className="h-4 w-4" />}
          />
          <MetricCard
            label="کلیک‌ها"
            value={formatNumber(totalClicks)}
            delta={clickDelta}
            icon={<IconMousePointer className="h-4 w-4" />}
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
            label="کمپین‌های فعال"
            value={formatNumber(activeCampaigns)}
            delta={null}
            deltaLabel="همکاری در جریان"
            icon={<IconRocket className="h-4 w-4" />}
          />
        </div>

        <PerformanceChart
          points={chartPoints}
          title="نمای عملکرد"
          subtitle="درآمد و تبدیل‌ها در طول زمان"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="تفکیک درآمد"
            subtitle="توزیع درآمد بر اساس کمپین"
          >
            <div className="p-5">
              {topBreakdown.length > 0 ? (
                <DonutChart
                  data={topBreakdown}
                  centerLabel="کل درآمد"
                  centerValue={formatCompactRials(totalEarned)}
                />
              ) : (
                <p className="py-10 text-center text-sm text-subtle">
                  هنوز درآمدی ثبت نشده است.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="عملکرد تبدیل"
            subtitle="شاخص‌های کلیدی عملکرد"
          >
            <ConversionPerformance
              clicks={totalClicks}
              conversions={totalConversions}
              rate={conversionRate}
              avgValue={avgValue}
            />
          </SectionCard>
        </div>

        <SectionCard
          title="عملکرد کمپین‌ها"
          subtitle="کارایی همکاری‌های شما"
          actions={
            <ExportButton filename="behrio-campaigns.csv" rows={exportRows} />
          }
        >
          <CampaignTable rows={campaignRows} />
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="همکاری در فروش (رفرال)"
            subtitle="کمیسیون حاصل از فروش لینک شما"
          >
            {referralCampaigns.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-subtle">
                هنوز در کمپین همکاری فروشی فعال نیستید.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {referralCampaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {c.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {c.business} ·{" "}
                        {c.commission
                          ? `${formatRials(toNumber(c.commission))} کمیسیون / فروش`
                          : "کمیسیون بر اساس تبدیل"}
                      </p>
                      <div className="mt-2">
                        <TrackingLinkBox
                          campaignId={c.campaignId}
                          code={trackingByCampaign.get(c.campaignId) ?? undefined}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-left">
                      <p className="tabular text-sm font-semibold text-primary-soft">
                        {formatRials(c.earnings)}
                      </p>
                      <p className="tabular text-[11px] text-subtle">
                        {formatNumber(c.clicks)} کلیک · {formatNumber(c.conversions)} تبدیل
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="نمایش و برندینگ (CPM/CLIPPING)"
            subtitle="پرداخت به ازای هر هزار نمایش"
            actions={
              reportCampaigns.length > 0 ? (
                <SubmitReportButton campaigns={reportCampaigns} />
              ) : undefined
            }
          >
            {cpmCampaigns.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-subtle">
                هنوز در کمپین نمایشی (CPM) فعال نیستید.
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {cpmCampaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {c.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {c.business} ·{" "}
                        {c.ratePerThousand
                          ? `${formatRials(toNumber(c.ratePerThousand))} / هزار نمایش`
                          : "نرخ بر اساس نمایش"}
                      </p>
                    </div>
                    <div className="shrink-0 text-left">
                      <p className="tabular text-sm font-semibold text-primary-soft">
                        {formatRials(c.earnings)}
                      </p>
                      <p className="tabular text-[11px] text-subtle">
                        {formatNumber(c.clicks)} کلیک · {formatNumber(c.conversions)} تبدیل
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="لینک‌های پیگیری و رفرال"
          subtitle="کد و لینک اختصاصی شما برای هر کمپین فعال"
          actions={
            <SubmitConversionButton
              campaigns={linkCampaigns
                .filter((c): c is typeof c & { code: string } => Boolean(c.code))
                .map((c) => ({ id: c.id, name: c.name, code: c.code }))}
            />
          }
        >
          {linkCampaigns.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-subtle">
              هنوز در کمپین فعالی پذیرفته نشده‌اید.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {linkCampaigns.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {c.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {c.business}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-soft">
                      {c.type}
                    </span>
                  </div>
                  <div className="mt-3">
                    <TrackingLinkBox
                      campaignId={c.id}
                      code={c.code ?? undefined}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="فعالیت‌های اخیر"
          subtitle="آخرین رویدادهای مالی و همکاری"
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
