"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconClock } from "@/components/icons";

export default function SettleButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function runSettle() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/commissions/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "اجرای تسویه ناموفق بود.");
        return;
      }

      setMessage(
        `${data.closed?.length ?? 0} کمپین بسته و ${data.settled?.length ?? 0} کمپین تسویه شد.`
      );
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={runSettle}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        <IconClock className="h-4 w-4" />
        {loading ? "در حال تسویه..." : "اجرای تسویه خودکار"}
      </button>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      {message && <p className="text-xs font-medium text-primary-soft">{message}</p>}
    </div>
  );
}
