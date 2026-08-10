"use client";

import { useState } from "react";

export default function ApplyButton({
  campaignId,
  initialStatus,
}: {
  campaignId: string;
  initialStatus?: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
}) {
  const [status, setStatus] = useState(initialStatus ?? "NONE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "APPROVED") {
    return (
      <button
        disabled
        className="w-full cursor-default rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary-soft"
      >
        تأیید شده
      </button>
    );
  }

  if (status === "PENDING") {
    return (
      <button
        disabled
        className="w-full cursor-default rounded-xl border border-warn/25 bg-warn/10 px-4 py-2.5 text-sm font-semibold text-warn"
      >
        در انتظار بررسی
      </button>
    );
  }

  if (status === "REJECTED") {
    return (
      <button
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const res = await fetch(
              `/api/creator/campaigns/${campaignId}/apply`,
              { method: "POST" }
            );
            const data = await res.json();
            if (!res.ok) {
              setError(data.error || "ارسال درخواست ناموفق بود.");
              return;
            }
            setStatus((data.application?.status as "PENDING" | "APPROVED") ?? "PENDING");
          } catch {
            setError("خطا در اتصال به سرور.");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
      >
        {loading ? "در حال ارسال..." : "درخواست مجدد"}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const res = await fetch(
              `/api/creator/campaigns/${campaignId}/apply`,
              { method: "POST" }
            );
            const data = await res.json();
            if (!res.ok) {
              setError(data.error || "ارسال درخواست ناموفق بود.");
              return;
            }
            setStatus((data.application?.status as "PENDING" | "APPROVED") ?? "PENDING");
          } catch {
            setError("خطا در اتصال به سرور.");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
      >
        {loading ? "در حال ارسال..." : "درخواست همکاری"}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
