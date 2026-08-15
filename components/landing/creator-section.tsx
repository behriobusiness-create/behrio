import Link from "next/link";
import { Eyebrow } from "@/components/landing/section-heading";

export function CreatorSection() {
  return (
    <section id="creators" className="scroll-mt-24">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <div className="rounded-card border border-line bg-card px-6 py-10 md:px-12 md:py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <Eyebrow>برای کریتورها</Eyebrow>
              <h2 className="mt-4 text-2xl font-bold leading-[1.35] tracking-tight text-fg md:text-3xl">
                برای کریتورها: از محتوایتان درآمد بسازید
              </h2>
              <p className="mt-4 text-base leading-8 text-muted">
                به کمپین‌های مناسب دسترسی پیدا کنید، محتوای کوتاه تولید کنید و
                بر اساس بازدید تأییدشده درآمد بگیرید.
              </p>
            </div>

            <Link
              href="/signup"
              className="inline-flex w-fit shrink-0 items-center justify-center rounded-xl border border-line bg-surface px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              پیوستن به شبکه کریتورها
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}