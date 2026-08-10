import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin-shell";
import { Badge, Card } from "@/components/ui";
import {
  IconDashboard,
  IconRocket,
  IconBank,
  IconUsers,
} from "@/components/icons";
import IntegrationActions from "../integration-actions";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "یکپارچه‌سازی‌ها", href: "/admin/integrations", icon: <IconRocket className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
];

const statusLabel: Record<string, string> = {
  NOT_CONFIGURED: "تنظیم نشده",
  CONFIGURED: "تنظیم شده",
  VERIFICATION_PENDING: "در انتظار تأیید",
  VERIFIED: "تأیید شده",
  FAILED: "ناموفق",
  DISABLED: "غیرفعال",
};

const statusTone: Record<string, "default" | "violet" | "green" | "amber" | "blue" | "red"> = {
  NOT_CONFIGURED: "default",
  CONFIGURED: "blue",
  VERIFICATION_PENDING: "amber",
  VERIFIED: "green",
  FAILED: "red",
  DISABLED: "red",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminIntegrationsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const integrations = await prisma.campaignIntegration.findMany({
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          business: { select: { companyName: true } },
        },
      },
      apiKey: { select: { keyPrefix: true, revokedAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pending = integrations.filter(
    (i) => i.status === "VERIFICATION_PENDING"
  ).length;

  return (
    <AdminShell items={nav} activeHref="/admin/integrations">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">یکپارچه‌سازی‌ها</h1>
          <p className="mt-1 text-sm text-muted">
            {pending > 0
              ? `${pending} یکپارچه‌سازی در انتظار تأیید.`
              : "هیچ درخواست تأیید در انتظاری نیست."}
          </p>
        </div>

        <div className="space-y-3">
          {integrations.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
              <p className="text-lg font-semibold text-subtle">
                هنوز یکپارچه‌سازی‌ای ثبت نشده است.
              </p>
            </div>
          )}

          {integrations.map((integration) => (
            <Card key={integration.id}>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-fg">
                      {integration.campaign.name}
                    </h2>
                    <Badge tone={statusTone[integration.status] ?? "default"}>
                      {statusLabel[integration.status] ?? integration.status}
                    </Badge>
                    <Badge tone="default">{integration.campaign.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {integration.campaign.business.companyName}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
                    {integration.apiKey && (
                      <span>
                        کلید: {integration.apiKey.keyPrefix}••••••
                        {integration.apiKey.revokedAt ? " (لغو شده)" : ""}
                      </span>
                    )}
                    {integration.verifiedAt && (
                      <span>تأیید شده: {formatDate(integration.verifiedAt)}</span>
                    )}
                    {integration.lastVerifiedAt && (
                      <span>آخرین تأیید: {formatDate(integration.lastVerifiedAt)}</span>
                    )}
                    {integration.testClickId && (
                      <span className="max-w-xs truncate" dir="ltr">
                        تست: {integration.testClickId}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <IntegrationActions
                    integrationId={integration.id}
                    status={integration.status}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}