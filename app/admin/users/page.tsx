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
import UserStatusActions from "./user-status-actions";

const nav = [
  { label: "داشبورد", href: "/admin", icon: <IconDashboard className="h-5 w-5" /> },
  { label: "کمپین‌ها", href: "/admin/campaigns", icon: <IconRocket className="h-5 w-5" /> },
  { label: "برداشت‌ها", href: "/admin/withdrawals", icon: <IconBank className="h-5 w-5" /> },
  { label: "کاربران", href: "/admin/users", icon: <IconUsers className="h-5 w-5" /> },
];

const roleLabel: Record<string, string> = {
  CREATOR: "خالق محتوا",
  BUSINESS: "کسب‌وکار",
  ADMIN: "مدیر",
};

const roleTone: Record<string, "green" | "blue" | "amber" | "default"> = {
  CREATOR: "green",
  BUSINESS: "blue",
  ADMIN: "amber",
};

const statusTone: Record<string, "green" | "red" | "default"> = {
  ACTIVE: "green",
  SUSPENDED: "red",
  DELETED: "default",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "فعال",
  SUSPENDED: "تعلیق‌شده",
  DELETED: "حذف‌شده",
};

export default async function AdminUsersPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      creatorProfile: { select: { displayName: true } },
      businessProfile: { select: { companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell items={nav} activeHref="/admin/users">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">کاربران</h1>
          <p className="mt-1 text-sm text-muted">
            مدیریت حساب‌های کاربری ({users.length} کاربر).
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {users.map((u) => {
            const displayName =
              u.creatorProfile?.displayName ||
              u.businessProfile?.companyName ||
              u.name ||
              "کاربر بدون مشخصات";
            const identifier = u.email || u.phone;

            return (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-bg">
                        {displayName.charAt(0)}
                      </span>
                      <p className="truncate font-semibold text-fg">
                        {displayName}
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {identifier && (
                        <p dir="ltr" className="truncate text-right text-xs text-muted">
                          {identifier}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {u.role ? (
                          <Badge tone={roleTone[u.role] ?? "default"}>
                            {roleLabel[u.role] ?? u.role}
                          </Badge>
                        ) : (
                          <Badge>ناقص</Badge>
                        )}
                        <Badge tone={statusTone[u.status] ?? "default"}>
                          {statusLabel[u.status] ?? u.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {u.role && u.role !== "ADMIN" && (
                      <UserStatusActions userId={u.id} status={u.status} />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
