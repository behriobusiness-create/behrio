import Link from "next/link";
import { Eyebrow } from "@/components/landing/section-heading";
import { HeroDashboard } from "@/components/landing/hero-dashboard";

const TRUST_POINTS = [
  "کمپین بسازید",
  "کریتور پیدا کنید",
  "بازدید را بسنجید",
  "شفاف تسویه کنید",
];

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 md:pb-24 md:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="animate-rise text-center lg:text-right">
          <Eyebrow>پرفورمنس مارکتینگ برای عصر کریتورها</Eyebrow>

          <h1 className="mt-5 text-4xl font-bold leading-[1.3] tracking-tight text-fg sm:text-5xl sm:leading-[1.25]">
            بازدید کریتورها را به{" "}
            <span className="text-primary-bright">
              رشد قابل‌اندازه‌گیری
            </span>{" "}
            تبدیل کنید
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-muted lg:mx-0">
            با BEHRIO کمپین‌های CPM بسازید، با کریتورهای مناسب همکاری کنید و
            عملکرد محتوا، بازدیدها و هزینه کمپین را شفاف ببینید.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/signup"
              className="rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-bg transition-colors hover:bg-primary-bright focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              شروع کمپین
            </Link>
            <Link
              href="/#how"
              className="rounded-xl border border-line bg-card px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              مشاهده نحوه کار
            </Link>
          </div>

          <p className="mt-7 text-sm text-subtle">
            {TRUST_POINTS.map((point, i) => (
              <span key={point} className="whitespace-nowrap">
                {i > 0 && <span className="mx-2 text-line">·</span>}
                {point}
              </span>
            ))}
          </p>
        </div>

        <div className="animate-rise min-w-0" style={{ animationDelay: "90ms" }}>
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}