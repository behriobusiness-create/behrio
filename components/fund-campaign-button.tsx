"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCoins, IconX } from "@/components/icons";

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export function FundCampaignButton({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!amount || Number(amount) <= 0) {
      setError("مبلغ را به تومان وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/business/campaigns/${campaignId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "انتقال بودجه ناموفق بود.");
        return;
      }

      setSuccess(
        `انتقال موفق: ${formatNumber(data.campaign.budget)} تومان بودجه کمپین.`
      );
      setAmount("");
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-hover px-2.5 py-1.5 text-xs font-semibold text-fg transition-colors hover:bg-surface"
        title="افزودن بودجه از کیف پول"
      >
        <IconCoins className="h-3.5 w-3.5 text-primary-soft" />
        افزودن بودجه
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => (loading ? null : setOpen(false))}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-fg">
                  پرداخت آزمایشی
                </h3>
                <p className="mt-1 text-xs text-subtle">{campaignName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                  setSuccess("");
                }}
                className="rounded-lg p-1 text-subtle transition-colors hover:bg-hover hover:text-fg"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-info/25 bg-info/10 px-4 py-3">
              <p className="text-xs font-semibold text-info">انتقال از کیف پول</p>
              <p className="mt-1 text-xs leading-5 text-info/90">
                مبلغ از موجودی کیف پول شما به بودجه کمپین منتقل و رزرو می‌شود.
                در صورت لغو یا پایان کمپین، مبلغ استفاده‌نشده به کیف پول برمی‌گردد.
              </p>
            </div>

            <form onSubmit={handlePay} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  مبلغ (تومان)
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
                  required
                  placeholder="مثلاً 5000000"
                  className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-right text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  dir="ltr"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-xs font-medium text-primary-soft">
                  {success}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
                >
                  {loading ? "در حال انتقال..." : "انتقال از کیف پول"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-hover"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}