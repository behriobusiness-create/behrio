"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CampaignReviewActions({
  campaignId,
}: {
  campaignId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APPROVE" | "CANCEL" | null>(null);
  const [error, setError] = useState("");

  async function review(action: "APPROVE" | "CANCEL") {
    setLoading(action);
    setError("");

    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: action === "APPROVE" ? "ACTIVE" : "CANCELLED",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "بررسی کمپین ناموفق بود.");
        return;
      }

      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => review("APPROVE")}
          disabled={loading !== null}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
        >
          {loading === "APPROVE" ? "..." : "تأیید و فعال‌سازی"}
        </button>
        <button
          onClick={() => review("CANCEL")}
          disabled={loading !== null}
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
        >
          {loading === "CANCEL" ? "..." : "رد"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
