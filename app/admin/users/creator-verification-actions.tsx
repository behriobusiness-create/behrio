"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  creatorId: string;
  currentStatus: string;
  screenshotUrl?: string | null;
};

export default function CreatorVerificationActions({
  creatorId,
  currentStatus,
  screenshotUrl,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  async function apply(next: "VERIFIED" | "REJECTED") {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/creators/${creatorId}/verification`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "تغییر وضعیت ناموفق بود.");
        return;
      }

      setStatus(next);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {screenshotUrl && (
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-fg"
          >
            {showPreview ? "بستن تصویر" : "مشاهده مدرک"}
          </button>
        )}

        <button
          type="button"
          onClick={() => apply("VERIFIED")}
          disabled={loading || status === "VERIFIED"}
          className="rounded-xl bg-success px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          تایید
        </button>

        <button
          type="button"
          onClick={() => apply("REJECTED")}
          disabled={loading || status === "REJECTED"}
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          رد
        </button>
      </div>

      {showPreview && screenshotUrl && (
        <div className="mt-2">
          <img
            src={screenshotUrl}
            alt="اسکرین‌شات اینستاگرام"
            className="max-h-64 w-full rounded-xl border border-line object-contain"
          />
        </div>
      )}

      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}