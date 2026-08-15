import { SectionHeading } from "@/components/landing/section-heading";

const PROBLEMS = [
  {
    num: "۱",
    title: "قیمت ثابت، بدون ارتباط شفاف با نتیجه",
    body: "هزینه‌ها بر اساس بازدید واقعی محاسبه نمی‌شود و ارتباط مستقیمی با نتیجه‌ی کمپین ندارند.",
  },
  {
    num: "۲",
    title: "گزارش‌های پراکنده و غیرقابل‌اعتماد",
    body: "اسکرین‌شات‌های دستی و اعداد متفاوت، بررسی و اعتماد به عملکرد را دشوار می‌کند.",
  },
  {
    num: "۳",
    title: "مدیریت سخت کمپین، محتوا و پرداخت",
    body: "هماهنگی کریتورها، محتوا و پرداخت در ابزارهای پراکنده انجام می‌شود و قابل پیگیری نیست.",
  },
];

export function Problem() {
  return (
    <section id="problem" className="scroll-mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <SectionHeading
          eyebrow="مسئله"
          title="تبلیغات کریتوری نباید بر اساس حدس و اسکرین‌شات باشد"
          description="بسیاری از همکاری‌های کریتوری امروز بدون داده‌های قابل‌اعتماد و فرآیند مشخص پیش می‌روند."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <article
              key={problem.num}
              className="rounded-card border border-line bg-card p-7 transition-colors hover:bg-hover"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-hover text-base font-bold text-muted">
                {problem.num}
              </span>
              <h3 className="mt-5 text-lg font-semibold leading-7 text-fg">
                {problem.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted">{problem.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}