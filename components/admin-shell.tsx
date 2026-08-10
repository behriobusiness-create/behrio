import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import type { NavSection } from "@/components/dashboard/nav";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const HOME_ROUTES = ["/admin"];

export function AdminShell({
  items,
  activeHref,
  title,
  subtitle,
  actions,
  children,
}: {
  items: AdminNavItem[];
  activeHref: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sections: NavSection[] = [
    {
      title: "منو",
      items: items.map((item) => ({
        ...item,
        home: HOME_ROUTES.includes(item.href),
      })),
    },
  ];

  const activeItem = items.find((i) => i.href === activeHref);

  return (
    <DashboardLayout
      sections={sections}
      activeHref={activeHref}
      user={{ name: "مدیر سیستم", subtitle: "Behrio" }}
      logoHref="/admin"
      title={title ?? activeItem?.label ?? "Behrio"}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </DashboardLayout>
  );
}
