"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserStatusActions({
  userId,
  status,
}: {
  userId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);

  async function toggle() {
    const next = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "تغییر وضعیت ناموفق بود.");
        return;
      }

      setCurrentStatus(next);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
          currentStatus === "ACTIVE"
            ? "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
            : "bg-primary text-bg hover:bg-primary-bright"
        }`}
      >
        {loading
          ? "..."
          : currentStatus === "ACTIVE"
            ? "تعلیق"
            : "فعال‌سازی"}
      </button>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
