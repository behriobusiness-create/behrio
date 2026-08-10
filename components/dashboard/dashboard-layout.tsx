"use client";

import { useState } from "react";
import type { NavSection } from "./nav";
import { SidebarContent, type SidebarUser } from "./sidebar";
import { Topbar } from "./topbar";
import { IconX } from "@/components/icons";

export function DashboardLayout({
  sections,
  activeHref,
  user,
  logoHref,
  title,
  subtitle,
  actions,
  children,
}: {
  sections: NavSection[];
  activeHref: string;
  user: SidebarUser;
  logoHref?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-fg" dir="rtl">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 flex-col border-e border-line bg-surface lg:flex">
        <SidebarContent
          sections={sections}
          activeHref={activeHref}
          user={user}
          logoHref={logoHref}
        />
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-60 flex-col border-e border-line bg-surface transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute end-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-hover text-muted transition-colors hover:text-fg"
          aria-label="بستن منو"
        >
          <IconX className="h-4 w-4" />
        </button>
        <SidebarContent
          sections={sections}
          activeHref={activeHref}
          user={user}
          logoHref={logoHref}
        />
      </aside>

      <div className="flex min-h-screen flex-col lg:ms-60">
        <Topbar
          title={title}
          subtitle={subtitle}
          actions={actions}
          onMenuClick={() => setOpen(true)}
        />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
