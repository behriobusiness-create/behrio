"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCoins, IconX } from "@/components/icons";

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export function WalletTopUpButton() {
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
      const res = await fetch("/api/payments/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "پرداخت آزمایشی ناموفق بود.");
        return;
      }

      setSuccess(
        `کیف پول شارژ شد: ${formatNumber(data.amount)} تومان. موجودی فعلی: ${formatNumber(data.wallet?.available ?? 0)} تومان.`
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-primary-bright"
        title="شارژ کیف پول با درگاه آزمایشی"
      >
        <IconCoins className="h-3.5 w-3.5" />
        شارژ کیف پول
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
                  شارژ کیف پول
                </h3>
                <p className="mt-1 text-xs text-subtle">
                  درگاه پرداخت آزمایشی
                </p>
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
              <p className="text-xs font-semibold text-info">درگاه پرداخت آزمایشی</p>
              <p className="mt-1 text-xs leading-5 text-info/90">
                این یک شبیه‌ساز است و هیچ مبلغ واقعی از شما کسر نمی‌شود. پس از
                شارژ، از موجودی کیف پول برای ساخت کمپین و افزودن بودجه استفاده
                می‌شود.
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
                  placeholder="مثلاً ۵۰۰۰۰۰"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-xs text-success">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "در حال پردازش…" : "پرداخت و شارژ"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
