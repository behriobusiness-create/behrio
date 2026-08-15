import Link from "next/link";
import { Logo } from "@/components/logo";

type FooterLink = {
  href: string;
  label: string;
};

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "محصول",
    links: [
      { href: "/#business", label: "کمپین CPM" },
      { href: "/#how", label: "نحوه کار" },
      { href: "/#creators", label: "برای کریتورها" },
    ],
  },
  {
    heading: "دسترسی",
    links: [
      { href: "/login", label: "ورود" },
      { href: "/signup", label: "ثبت‌نام" },
    ],
  },
  {
    heading: "شرکت",
    links: [
      { href: "/", label: "درباره BEHRIO" },
      { href: "/", label: "قوانین و حریم خصوصی" },
      { href: "/", label: "تماس با ما" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-7 text-muted">
              پلتفرم پرفورمنس مارکتینگ برای کمپین‌های CPM — از تعریف کمپین تا
              تسویه‌ی شفاف بر اساس بازدید واقعی.
            </p>
          </div>

          <nav
            aria-label="پیوندهای پابرگ"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3"
          >
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <h3 className="text-xs font-semibold text-subtle">
                  {column.heading}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-subtle md:flex-row">
          <p>© ۲۰۲۶ BEHRIO. تمامی حقوق محفوظ است.</p>
          <p>کمپین CPM · بازدید تأییدشده · تسویه بر اساس عملکرد</p>
        </div>
      </div>
    </footer>
  );
}