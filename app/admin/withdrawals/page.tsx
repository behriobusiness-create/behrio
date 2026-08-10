import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { AdminShell } from "@/components/admin-shell";
import {
  IconDashboard,
  IconRocket,
  IconBank,
  IconUsers,
} from "@/components/icons";
import WithdrawalActions from "./actions";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export default async function AdminWithdrawalsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== "ADMIN") redirect("/");

  const withdrawals = await prisma.withdrawal.findMany({
    where: {
      status: { in: ["REQUESTED", "PROCESSING"] },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          creatorProfile: {
            select: { displayName: true },
          },
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <AdminShell items={nav} activeHref="/admin/withdrawals">
      <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-fg">
              درخواست‌های برداشت
            </h1>
            <p className="mt-1 text-sm text-muted">
              {withdrawals.length} درخواست در انتظار.
            </p>
          </div>

          <div className="space-y-4">
            {withdrawals.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
                <p className="text-lg font-semibold text-subtle">
                  درخواست جدیدی وجود ندارد.
                </p>
              </div>
            )}

            {withdrawals.map((item) => {
              const creatorName =
                item.user.creatorProfile?.displayName ||
                item.user.name ||
                item.user.phone ||
                "کاربر";

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-line bg-card p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-bg">
                          {creatorName.charAt(0)}
                        </span>
                        <div>
                          <p className="font-semibold text-fg">
                            {creatorName}
                          </p>
                          <p dir="ltr" className="text-right text-xs text-subtle">
                            {item.user.phone}
                          </p>
                        </div>
                      </div>

                      <p className="pt-1 text-2xl font-semibold text-fg">
                        {formatNumber(Number(item.amount))} تومان
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {item.bankName && (
                          <span className="rounded-full bg-hover px-2.5 py-0.5">
                            {item.bankName}
                          </span>
                        )}
                        {item.iban && (
                          <span dir="ltr" className="font-mono">
                            {item.iban}
                          </span>
                        )}
                        <Badge tone={item.status === "PROCESSING" ? "blue" : "amber"}>
                          {item.status === "PROCESSING" ? "در حال پردازش" : "درخواست‌شده"}
                        </Badge>
                      </div>
                    </div>

                    <div className="shrink-0 sm:pt-1">
                      <WithdrawalActions
                        withdrawal={{
                          id: item.id,
                          amount: String(item.amount),
                          currency: item.currency,
                          status: item.status,
                          iban: item.iban,
                          bankName: item.bankName,
                          requestedAt: item.requestedAt.toISOString(),
                          creatorName,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      </div>
    </AdminShell>
  );
}
