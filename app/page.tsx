import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") redirect("/admin");
    if (user.role === "BUSINESS") redirect("/business");
    if (user.role === "CREATOR") redirect("/creator");
    redirect("/onboarding");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-bg">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-hover"
          >
            ورود
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright"
          >
            شروع کنید
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-24 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold uppercase leading-tight tracking-[0.18em] text-fg md:text-7xl">
          BEHIRO
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-semibold leading-8 text-primary-soft md:text-xl">
          بساز، فاند کن، دیده شو
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-bg transition-colors hover:bg-primary-bright"
          >
            شروع کنید
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-line bg-card px-8 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-hover"
          >
            مشاهده کمپین‌ها
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-card p-7">
            <h3 className="text-lg font-semibold text-fg">
              ساخت آسان کمپین
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted">
              برندها کمپین‌های CPC و CPA ایجاد می‌کنند، بودجه تعیین می‌کنند و
              با تولیدکنندگان محتوا همکاری می‌کنند.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-card p-7">
            <h3 className="text-lg font-semibold text-fg">
              درآمد از محتوا
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted">
              تولیدکنندگان محتوا از طریق لینک اختصاصی خود به‌ازای هر کلیک و
              هر تبدیل درآمد قابل برداشت کسب می‌کنند.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-card p-7">
            <h3 className="text-lg font-semibold text-fg">
              گزارش‌گیری شفاف
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted">
              کلیک‌ها، تبدیل‌ها و هزینه‌ها به‌صورت لحظه‌ای پیگیری و در
              داشبورد شما نمایش داده می‌شود.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted md:flex-row">
          <Logo href="/" />
          <p>© 2025 Behrio. تمامی حقوق محفوظ است.</p>
        </div>
      </footer>
    </main>
  );
}
