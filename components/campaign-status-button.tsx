"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CampaignStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

type Action = {
  target: "PENDING_REVIEW" | "ACTIVE" | "PAUSED";
  label: string;
  className: string;
  busyLabel: string;
};

const ACTIONS: Record<CampaignStatus, Action | null> = {
  DRAFT: {
    target: "PENDING_REVIEW",
    label: "ارسال برای بررسی",
    className:
      "rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-primary-bright",
    busyLabel: "در حال ارسال...",
  },
  ACTIVE: {
    target: "PAUSED",
    label: "توقف کمپین",
    className:
      "rounded-lg border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs font-semibold text-warn transition-colors hover:bg-warn/20",
    busyLabel: "در حال توقف...",
  },
  PAUSED: {
    target: "ACTIVE",
    label: "ادامه کمپین",
    className:
      "rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-primary-bright",
    busyLabel: "در حال فعال‌سازی...",
  },
  PENDING_REVIEW: null,
  COMPLETED: null,
  CANCELLED: null,
};

export function CampaignStatusButton({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const action = ACTIONS[status];

  if (!action) return null;

  const targetStatus = action.target;

  async function changeStatus() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "تغییر وضعیت کمپین ناموفق بود.");
        return;
      }

      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={changeStatus}
        disabled={loading}
        className={action.className}
      >
        {loading ? action.busyLabel : action.label}
      </button>
      {error && (
        <span className="text-[11px] font-medium text-danger">{error}</span>
      )}
    </div>
  );
}
