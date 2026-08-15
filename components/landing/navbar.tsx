"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { IconMenu, IconX } from "@/components/icons";

const NAV_LINKS = [
  { href: "/#how", label: "چگونه کار می‌کند" },
  { href: "/#business", label: "برای کسب‌وکارها" },
  { href: "/#creators", label: "برای کریتورها" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Logo />

        <nav
          aria-label="ناوبری اصلی"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            ورود
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            شروع کمپین
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "بستن منو" : "باز کردن منو"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:hidden"
        >
          {open ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-bg px-5 pb-5 pt-3 md:hidden">
          <nav aria-label="ناوبری موبایل" className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-hover px-4 py-2.5 text-center text-sm font-semibold text-fg transition-colors hover:bg-hover/70"
              >
                ورود
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-bg transition-colors hover:bg-primary-bright"
              >
                شروع کمپین
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}