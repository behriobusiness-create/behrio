"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportReviewActions({
  reportId,
  status,
}: {
  reportId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function review(action: "APPROVE" | "REJECT") {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/campaign-reports/${reportId}/${action === "APPROVE" ? "approve" : "reject"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => review("APPROVE")}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
        <p className="mt-2 max-w-[240px] text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}