import { SectionHeading } from "@/components/landing/section-heading";

const STEPS = [
  {
    num: "۱",
    title: "کمپین بسازید",
    body: "بودجه، هدف بازدید، حوزه فعالیت و قوانین محتوا را مشخص کنید.",
  },
  {
    num: "۲",
    title: "با کریتورها همکاری کنید",
    body: "کریتورهای مناسب کمپین را پیدا می‌کنند و محتوای خود را منتشر می‌کنند.",
  },
  {
    num: "۳",
    title: "عملکرد را بسنجید",
    body: "بازدیدها، هزینه و عملکرد هر کریتور را در یک داشبورد ببینید.",
  },
  {
    num: "۴",
    title: "بر اساس عملکرد تسویه کنید",
    body: "پرداخت‌ها بر اساس بازدید تأییدشده و قوانین کمپین محاسبه می‌شوند.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <SectionHeading
          eyebrow="چگونه کار می‌کند"
          title="از تعریف کمپین تا تسویه، در یک مسیر مشخص"
          description="چهار قدم ساده برای راه‌اندازی و مدیریت کمپین‌های کریتوری."
        />

        <ol className="mt-12 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.num} className="relative">
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-5 top-9 hidden h-px w-[calc(100%-3rem)] border-t border-dashed border-line lg:block"
                />
              )}
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-base font-bold text-primary-bright">
                {step.num}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-fg">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}