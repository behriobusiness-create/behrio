"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IntegrationActions({
  integrationId,
  status,
}: {
  integrationId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(action: "APPROVE" | "REJECT" | "DISABLE" | "ENABLE") {
    setLoading(action);
    setError("");
    try {
      const res = await fetch(`/api/admin/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "عملیات ناموفق بود.");
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
      <div className="flex flex-wrap gap-2">
        {status !== "VERIFIED" && (
          <button
            onClick={() => act("APPROVE")}
            disabled={loading !== null || status === "DISABLED"}
            title="تأیید دستی یکپارچه‌سازی"
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
          >
            {loading === "APPROVE" ? "..." : "تأیید"}
          </button>
        )}
        {(status === "VERIFICATION_PENDING" || status === "FAILED") && (
          <button
            onClick={() => act("REJECT")}
            disabled={loading !== null}
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
          >
            {loading === "REJECT" ? "..." : "رد"}
          </button>
        )}
        {status !== "DISABLED" && (
          <button
            onClick={() => act("DISABLE")}
            disabled={loading !== null}
            className="rounded-xl border border-line bg-hover px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-50"
          >
            {loading === "DISABLE" ? "..." : "غیرفعال"}
          </button>
        )}
        {status === "DISABLED" && (
          <button
            onClick={() => act("ENABLE")}
            disabled={loading !== null}
            className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-soft transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {loading === "ENABLE" ? "..." : "فعال‌سازی مجدد"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}