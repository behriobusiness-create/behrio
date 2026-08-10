import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import type { NavSection } from "@/components/dashboard/nav";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

export type UserView = {
  name: string;
  subtitle?: string;
};

const HOME_ROUTES = ["/creator", "/business", "/admin"];

export function DashboardShell({
  items,
  user,
  activeHref,
  title,
  subtitle,
  actions,
  children,
}: {
  items: NavItem[];
  user: UserView;
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
      user={user}
      title={title ?? activeItem?.label ?? "Behrio"}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </DashboardLayout>
  );
}
