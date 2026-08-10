"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { labelClass, inputClass } from "@/components/ui";

export default function WithdrawForm({
  maxAmount,
  commissionRate,
}: {
  maxAmount: number;
  commissionRate: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const parsed = Number(amount);
  const validAmount = !Number.isNaN(parsed) && parsed > 0;
  const fee = validAmount ? Math.round((parsed * commissionRate) / 100) : 0;
  const net = validAmount ? parsed - fee : 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError("مبلغ برداشت نامعتبر است.");
      return;
    }

    if (parsed > maxAmount) {
      setError(
        `موجودی قابل برداشت فقط ${maxAmount.toLocaleString("fa-IR")} تومان است.`
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/creator/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, iban, bankName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "برداشت ناموفق بود.");
        return;
      }

      setSuccess("درخواست برداشت ثبت شد.");
      setAmount("");
      setIban("");
      setBankName("");
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>مبلغ (تومان)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          placeholder="مثلاً 500000"
          className={inputClass}
          dir="ltr"
        />
      </div>

      <div>
        <label className={labelClass}>شماره شبا</label>
        <input
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IR... (اختیاری)"
          className={inputClass}
          dir="ltr"
        />
      </div>

      <div>
        <label className={labelClass}>نام بانک</label>
        <input
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="مثلاً ملی (اختیاری)"
          className={inputClass}
        />
      </div>

      {validAmount && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">مبلغ ناخالص</span>
            <span className="tabular font-semibold text-fg">
              {parsed.toLocaleString("fa-IR")} تومان
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">
              کارمزد برداشت ({commissionRate}٪)
            </span>
            <span className="tabular font-semibold text-danger">
              -{fee.toLocaleString("fa-IR")} تومان
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-line/60 pt-1.5">
            <span className="font-medium text-fg">مبلغ قابل دریافت</span>
            <span className="tabular text-base font-bold text-primary-soft">
              {net.toLocaleString("fa-IR")} تومان
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-600">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || maxAmount <= 0}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? "در حال ثبت..." : "درخواست برداشت"}
      </button>
    </form>
  );
}
