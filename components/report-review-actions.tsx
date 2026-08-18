"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportReviewActions({
  reportId,
  status,
  claimedImpressions,
}: {
  reportId: string;
  status: string;
  claimedImpressions: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState<string>(
    String(claimedImpressions)
  );

  async function review(action: "APPROVE" | "REJECT") {
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {};
      if (action === "APPROVE") {
        const parsed = Number(verified);
        if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
          setError("تعداد نمایش تأییدشده باید عدد صحیح و نامنفی باشد.");
          setLoading(false);
          return;
        }
        payload.verifiedImpressions = parsed;
      }

      const res = await fetch(
        `/api/campaign-reports/${reportId}/${action === "APPROVE" ? "approve" : "reject"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "بررسی گزارش ناموفق بود.");
        return;
      }

      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        تأیید و پرداخت شد
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        رد شده
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-[11px] text-muted">
          ویو تأییدشده (پس از بررسی مدرک)
        </label>
        <input
          type="number"
          value={verified}
          onChange={(e) => setVerified(e.target.value)}
          min={0}
          step={1000}
          dir="ltr"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-right text-sm text-fg outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => review("APPROVE")}
          disabled={loading}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : "تأیید و پرداخت"}
        </button>
        <button
          onClick={() => review("REJECT")}
          disabled={loading}
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          رد
        </button>
      </div>
      {error && (
        <p className="max-w-[240px] text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}