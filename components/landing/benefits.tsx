import {
  IconTarget,
  IconChart,
  IconCheck,
  IconTrendingUp,
} from "@/components/icons";
import { SectionHeading } from "@/components/landing/section-heading";

const BENEFITS = [
  {
    icon: IconTarget,
    title: "کمپین CPM",
    body: "به جای حدس، برای بازدید تأییدشده هزینه کنید.",
  },
  {
    icon: IconChart,
    title: "گزارش شفاف",
    body: "هزینه، بازدید و عملکرد کریتورها را یکجا ببینید.",
  },
  {
    icon: IconCheck,
    title: "اجرای ساده",
    body: "بریف، محتوا، بررسی و پرداخت را در یک مسیر مدیریت کنید.",
  },
  {
    icon: IconTrendingUp,
    title: "رشد قابل تکرار",
    body: "از داده‌ی کمپین‌های قبلی برای تصمیم‌های بهتر استفاده کنید.",
  },
];

export function Benefits() {
  return (
    <section
      id="business"
      className="scroll-mt-24 border-t border-line bg-surface"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <SectionHeading
          eyebrow="برای کسب‌وکارها"
          title="برای کسب‌وکارهایی که می‌خواهند تبلیغات‌شان قابل‌اندازه‌گیری باشد"
          description="مدیریت کمپین، کریتور، محتوا و پرداخت — همه در یک پلتفرم جدی و قابل بررسی."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article
                key={benefit.title}
                className="rounded-card border border-line bg-card p-6 transition-colors hover:bg-hover"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-hover text-muted transition-colors">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-fg">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {benefit.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}