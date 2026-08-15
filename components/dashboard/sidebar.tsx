import Link from "next/link";
import {
  type NavSection,
  isActive,
  helpItems,
} from "./nav";
import { IconChevronDown, IconLogout } from "@/components/icons";
import { Logo } from "@/components/logo";

export type SidebarUser = {
  name: string;
  subtitle?: string;
};

export function SidebarContent({
  sections,
  activeHref,
  user,
  logoHref = "/",
}: {
  sections: NavSection[];
  activeHref: string;
  user: SidebarUser;
  logoHref?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
        <Logo href={logoHref} />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(activeHref, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                        active
                          ? "bg-primary/10 text-fg"
                          : "text-muted hover:bg-hover hover:text-fg"
                      }`}
                    >
                      <span
                        className={`shrink-0 transition-colors ${
                          active ? "text-primary-soft" : "text-subtle group-hover:text-muted"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <ul className="space-y-0.5">
          {helpItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
              >
                <span className="text-subtle">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-hover text-sm font-semibold text-fg">
            {(user.name || "؟").charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{user.name}</p>
            {user.subtitle && (
              <p className="truncate text-xs text-subtle">{user.subtitle}</p>
            )}
          </div>
          <IconChevronDown className="h-4 w-4 shrink-0 text-subtle" />
        </div>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <IconLogout className="h-4 w-4" />
            خروج
          </button>
        </form>
      </div>
    </div>
  );
}
