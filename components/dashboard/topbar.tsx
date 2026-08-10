"use client";

import { IconMenu } from "@/components/icons";

export function Topbar({
  title,
  subtitle,
  actions,
  onMenuClick,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:text-fg lg:hidden"
          aria-label="باز کردن منو"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-fg">{title}</h1>
          {subtitle && (
            <p className="hidden truncate text-xs text-subtle sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
