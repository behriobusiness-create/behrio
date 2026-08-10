import { getCurrentUser } from "@/lib/auth/current-user";
import { redirectForRole } from "@/lib/auth/role";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAvailableBalance } from "@/lib/wallet";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, StatCard, Badge } from "@/components/ui";
import {
  IconDashboard,
  IconStore,
  IconWallet,
  IconCard,
  IconChart,
  IconClock,
  IconBank,
} from "@/components/icons";
import WithdrawForm from "@/components/withdraw-form";
import { getCommissionConfig } from "@/lib/finance/commission";

const nav = [
  { label: "داشبورد", href: "/creator", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "بازار کمپین", href: "/creator/marketplace", icon: <IconStore className="h-5 w-5" /> },
  { label: "کیف پول", href: "/creator/wallet", icon: <IconWallet className="h-5 w-5" /> },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

const withdrawalTone: Record<string, "amber" | "green" | "red" | "default"> = {
  REQUESTED: "amber",
  PROCESSING: "amber",
  COMPLETED: "green",
  FAILED: "red",
};

export default async function CreatorWalletPage() {
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

  const earned = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { userId: user.id, type: "CREATOR_EARNING", status: "AVAILABLE" },
  });

  const withdrawn = await prisma.withdrawal.aggregate({
    _sum: { amount: true },
    where: { userId: user.id, status: "COMPLETED" },
  });

  const pending = await prisma.withdrawal.aggregate({
    _sum: { amount: true },
    where: { userId: user.id, status: { in: ["REQUESTED", "PROCESSING"] } },
  });

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 10,
  });

  const balance = await getAvailableBalance(prisma, user.id);
  const totalEarned = Number(earned._sum.amount ?? 0);
  const totalWithdrawn = Number(withdrawn._sum.amount ?? 0);
  const totalPending = Number(pending._sum.amount ?? 0);

  const commissionConfig = getCommissionConfig();

  return (
    <DashboardShell
      items={nav}
      activeHref="/creator/wallet"
      user={{
        name: fullUser.creatorProfile!.displayName || "کاربر",
        subtitle: `@${fullUser.creatorProfile!.instagramHandle || "بدون اینستاگرام"}`,
      }}
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-fg">کیف پول</h1>
          <p className="mt-1 text-sm text-muted">
            موجودی، درآمد و برداشت‌های خود را مدیریت کنید.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="موجودی قابل برداشت"
            value={`${formatNumber(balance.toNumber())} تومان`}
            icon={<IconCard className="h-5 w-5" />}
          />
          <StatCard
            label="کل درآمد"
            value={`${formatNumber(totalEarned)} تومان`}
            icon={<IconChart className="h-5 w-5" />}
          />
          <StatCard
            label="در انتظار تسویه"
            value={`${formatNumber(totalPending)} تومان`}
            icon={<IconClock className="h-5 w-5" />}
          />
          <StatCard
            label="برداشت‌شده"
            value={`${formatNumber(totalWithdrawn)} تومان`}
            icon={<IconBank className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-fg">
              درخواست برداشت
            </h2>
            <p className="mt-1 text-sm text-muted">
              حداکثر قابل برداشت: {formatNumber(balance.toNumber())} تومان
            </p>
            <div className="mt-5">
              <WithdrawForm
                maxAmount={balance.toNumber()}
                commissionRate={commissionConfig.creatorRate.toNumber()}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-fg">
              تاریخچه برداشت‌ها
            </h2>
            <div className="mt-4 space-y-3">
              {withdrawals.length === 0 && (
                <p className="text-sm text-muted">
                  هنوز برداشتی ندارید.
                </p>
              )}
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-line p-4"
                >
                  <div>
                    <p className="font-semibold text-fg">
                      {formatNumber(Number(w.amount))} تومان
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {w.bankName || "بدون بانک"}
                      {w.iban ? ` · ${w.iban}` : ""}
                    </p>
                    {w.netAmount !== null && (
                      <p className="mt-0.5 text-xs text-subtle">
                        قابل دریافت:{" "}
                        {formatNumber(Number(w.netAmount))} تومان
                        {w.commissionAmount !== null &&
                          ` (کارمزد ${formatNumber(Number(w.commissionAmount))} تومان)`}
                      </p>
                    )}
                  </div>
                  <Badge tone={withdrawalTone[w.status] ?? "default"}>
                    {w.status === "REQUESTED" && "در انتظار"}
                    {w.status === "PROCESSING" && "در حال پردازش"}
                    {w.status === "COMPLETED" && "تکمیل شده"}
                    {w.status === "FAILED" && "ناموفق"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
