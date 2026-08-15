"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { labelClass, inputClass } from "@/components/ui";

export default function CreateCampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [cpm, setCpm] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [accessType, setAccessType] = useState("OPEN");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload: Record<string, unknown> = {
      name,
      description,
      type: "CPM",
      accessType,
      budget: budget.trim(),
      cpm: cpm.trim(),
      destinationUrl,
    };

    setLoading(true);

    try {
      const res = await fetch("/api/business/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.wallet) {
          setError(
            `${data.error} موجودی فعلی: ${new Intl.NumberFormat("fa-IR").format(data.wallet.available)} تومان.`
          );
        } else {
          setError(data.error || "ایجاد کمپین ناموفق بود.");
        }
        return;
      }

      setSuccess("کمپین CPM ایجاد شد.");
      setName("");
      setDescription("");
      setBudget("");
      setCpm("");
      setDestinationUrl("");
      setAccessType("OPEN");
      setOpen(false);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright"
        >
          کمپین جدید
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>نام کمپین</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="مثلاً فروش تابستانه"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>نوع کمپین</label>
              <input
                value="CPM (پرداخت به‌ازای نمایش)"
                disabled
                readOnly
                className={inputClass}
              />
              <div className="mt-2 rounded-lg border border-info/25 bg-info/10 px-3 py-2.5">
                <p className="text-xs font-semibold text-info">
                  CPM چیست؟
                </p>
                <p className="mt-1 text-xs leading-5 text-info/90">
                  CPM = قیمت به‌ازای هر ۱٬۰۰۰ نمایش تأییدشده (ویو). درآمد خالق از
                  نمایش‌های تأییدشده محاسبه می‌شود.
                </p>
              </div>
            </div>
            <div>
              <label className={labelClass}>بودجه (تومان)</label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
                inputMode="decimal"
                placeholder="مثلاً 5000000"
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelClass}>نرخ CPM (تومان به‌ازای ۱۰۰۰ نمایش)</label>
              <input
                value={cpm}
                onChange={(e) => setCpm(e.target.value)}
                required
                inputMode="decimal"
                placeholder="مثلاً 200000"
                className={inputClass}
                dir="ltr"
              />
              <p className="mt-1.5 text-xs text-subtle">
                مثال: ۱۲۵٬۰۰۰ نمایش تأییدشده × (۲۰۰٬۰۰۰ / ۱۰۰۰) = ۲۵٬۰۰۰٬۰۰۰ تومان
              </p>
            </div>
            <div>
              <label className={labelClass}>نوع دسترسی</label>
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value)}
                className={inputClass}
              >
                <option value="OPEN">باز (همه تولیدکنندگان)</option>
                <option value="APPROVAL_REQUIRED">نیازمند تأیید کسب‌وکار</option>
                <option value="HYBRID">ترکیبی</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>آدرس مقصد</label>
              <input
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                required
                placeholder="https://example.com"
                className={inputClass}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="کمپین را برای تولیدکنندگان توضیح دهید..."
              className={`${inputClass} min-h-24 resize-none`}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary-soft">
              {success}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
            >
              {loading ? "در حال ایجاد..." : "ایجاد کمپین"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-hover"
            >
              انصراف
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
