import Link from "next/link";

export function FinalCta() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <div className="rounded-card border border-line bg-card px-6 py-16 text-center md:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-[1.3] tracking-tight text-fg md:text-4xl">
            اولین کمپین CPM خود را راه‌اندازی کنید
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-muted">
            کمپین خود را تعریف کنید و تبلیغات کریتوری را با داده واقعی مدیریت
            کنید.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-primary px-9 py-4 text-base font-semibold text-bg transition-colors hover:bg-primary-bright focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              شروع کمپین
            </Link>
            <Link
              href="/signup"
              className="rounded-xl px-6 py-4 text-base font-semibold text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              من کریتور هستم
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}