"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({
  applicationId,
  status,
  trackingLink,
}: {
  applicationId: string;
  status: string;
  trackingLink?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState(trackingLink ?? null);

  async function review(action: "APPROVE" | "REJECT") {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/business/applications/${applicationId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "بررسی ناموفق بود.");
        return;
      }

      if (data.trackingLink?.code) {
        setLink(data.trackingLink.code);
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
      <div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          تأیید شده
        </span>
        {link && (
          <p dir="ltr" className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-right font-mono text-xs text-zinc-600">
            /t/{link}
          </p>
        )}
      </div>
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
          {loading ? "..." : "تأیید"}
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
        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
      )}
      {link && (
        <p dir="ltr" className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-right font-mono text-xs text-zinc-600">
          /t/{link}
        </p>
      )}
    </div>
  );
}
