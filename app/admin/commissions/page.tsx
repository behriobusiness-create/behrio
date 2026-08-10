import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { AdminShell } from "@/components/admin-shell";
import {
  IconBank,
  IconChart,
  IconDashboard,
  IconPercent,
  IconRocket,
  IconUsers,
} from "@/components/icons";
import {
  CAMPAIGN_FEE_PREFIX,
  WITHDRAWAL_FEE_PREFIX,
  getCommissionConfig,
} from "@/lib/finance/commission";
import { formatNumber, formatRials, toNumber } from "@/lib/stats";
import SettleButton from "./settle-button";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "کارمزدها", href: "/admin/commissions", icon: <IconPercent className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
];

const feeTone: Record<string, "green" | "amber" | "red" | "blue" | "default"> = {
  AVAILABLE: "green",
  PENDING: "amber",
  REVERSED: "red",
};

function feeStatusLabel(status: string): string {
  switch (status) {
    case "AVAILABLE":
      return "واریز شده";
    case "PENDING":
      return "در انتظار";
    case "REVERSED":
      return "بازگشت داده شده";
    default:
      return status;
  }
}

export default async function AdminCommissionsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== "ADMIN") redirect("/");

  const config = getCommissionConfig();

  const feeWhere = { type: "PLATFORM_FEE" as const };

  const [campaignFeeAgg, withdrawalFeeAgg, pendingAgg, reversedAgg, history] =
    await Promise.all([
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: {
          ...feeWhere,
          status: "AVAILABLE",
          referenceId: { startsWith: CAMPAIGN_FEE_PREFIX },
        },
      }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: {
          ...feeWhere,
          status: "AVAILABLE",
          referenceId: { startsWith: WITHDRAWAL_FEE_PREFIX },
        },
      }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { ...feeWhere, status: "PENDING" },
      }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { ...feeWhere, status: "REVERSED" },
      }),
      prisma.ledgerEntry.findMany({
        where: feeWhere,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          campaign: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  const campaignFees = Number(campaignFeeAgg._sum.amount ?? 0);
  const withdrawalFees = Number(withdrawalFeeAgg._sum.amount ?? 0);
  const pendingFees = Number(pendingAgg._sum.amount ?? 0);
  const reversedFees = Number(reversedAgg._sum.amount ?? 0);
  const totalFees = campaignFees + withdrawalFees;

  return (
    <AdminShell
      items={nav}
      activeHref="/admin/commissions"
      title="کارمزدها"
      subtitle="درآمد پلتفرم از کارمزد تسویه کمپین‌ها و برداشت خالقان"
      actions={<SettleButton />}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">
              کارمزد تسویه کمپین‌ها ({config.businessRate.toNumber()}٪)
            </p>
            <p className="tabular mt-2 text-2xl font-semibold text-fg">
              {formatRials(campaignFees)}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {formatNumber(campaignFeeAgg._count._all)} کمپین تسویه‌شده
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">
              کارمزد برداشت خالقان ({config.creatorRate.toNumber()}٪)
            </p>
            <p className="tabular mt-2 text-2xl font-semibold text-fg">
              {formatRials(withdrawalFees)}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {formatNumber(withdrawalFeeAgg._count._all)} برداشت واریزشده
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">کارمزد در انتظار</p>
            <p className="tabular mt-2 text-2xl font-semibold text-warn">
              {formatRials(pendingFees)}
            </p>
            <p className="mt-1 text-xs text-subtle">
              برداشت‌های در حال پردازش
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">بازگشت‌داده‌شده</p>
            <p className="tabular mt-2 text-2xl font-semibold text-danger">
              {formatRials(reversedFees)}
            </p>
            <p className="mt-1 text-xs text-subtle">
              کارمزد برداشت‌های ناموفق
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">نرخ کارمزد کسب‌وکار</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-fg">
              {config.businessRate.toNumber()}٪
              <IconChart className="h-5 w-5 text-muted" />
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">نرخ کارمزد خالق</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-fg">
              {config.creatorRate.toNumber()}٪
              <IconPercent className="h-5 w-5 text-muted" />
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-subtle">مجموع کارمزد واریز‌شده</p>
            <p className="tabular mt-2 text-2xl font-semibold text-primary-soft">
              {formatRials(totalFees)}
            </p>
            <p className="mt-1 text-xs text-subtle">
              بدون احتساب کارمزدهای در انتظار و برگشتی
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">تاریخچه کارمزدها</h2>
              <p className="mt-0.5 text-sm text-muted">
                آخرین کارمزدهای ثبت‌شده در دفتر کل
              </p>
            </div>
          </div>
          {history.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-subtle">
              هنوز کارمزدی ثبت نشده است.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {history.map((entry) => {
                const isCampaign = entry.referenceId?.startsWith(CAMPAIGN_FEE_PREFIX);
                const actorName =
                  entry.user?.name ||
                  entry.user?.phone ||
                  entry.user?.email ||
                  (isCampaign
                    ? entry.campaign?.name || "کسب‌وکار"
                    : "خالق محتوا");
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-fg">
                          {isCampaign
                            ? `کارمزد تسویه کمپین ${entry.campaign?.name ?? ""}`
                            : "کارمزد برداشت خالق"}
                        </p>
                        <Badge tone={feeTone[entry.status] ?? "default"}>
                          {feeStatusLabel(entry.status)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {actorName}
                        {entry.referenceId ? ` · ${entry.referenceId}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-semibold text-fg">
                        {formatRials(toNumber(entry.amount))}
                      </p>
                      <p className="text-xs text-subtle">
                        {new Intl.DateTimeFormat("fa-IR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(entry.createdAt)}
                      </p>
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
