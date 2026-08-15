import { IconCheck } from "@/components/icons";
import { SectionHeading } from "@/components/landing/section-heading";

const TRUST_POINTS = [
  {
    title: "گزارش‌دهی شفاف",
    body: "مصرف بودجه، بازدید و عملکرد هر کریتور به‌صورت یکجا ثبت و قابل بررسی است.",
  },
  {
    title: "بررسی و تأیید کمپین",
    body: "محتوای کریتورها بر اساس قوانین کمپین بررسی و در صورت تطابق تأیید می‌شود.",
  },
  {
    title: "محاسبه مشخص درآمد",
    body: "درآمد کریتورها بر اساس بازدید تأییدشده و قوانین کمپین محاسبه می‌شود.",
  },
  {
    title: "فرآیند تسویه قابل‌پیگیری",
    body: "وضعیت هر پرداخت از ثبت درخواست تا تسویه در هر مرحله مشخص است.",
  },
];

export function Trust() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <SectionHeading
          eyebrow="شفافیت در هر مرحله"
          title="یک زیرساخت قابل‌اعتماد برای همکاری کریتوری"
          description="از ثبت کمپین تا تسویه نهایی، هر مرحله شفاف و قابل بررسی است."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TRUST_POINTS.map((point) => (
            <article
              key={point.title}
              className="flex gap-4 rounded-card border border-line bg-card p-6 transition-colors hover:bg-hover"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-bright">
                <IconCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-fg">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {point.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}