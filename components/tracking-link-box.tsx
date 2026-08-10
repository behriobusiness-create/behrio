"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLink, IconCopy, IconCheck } from "@/components/icons";
import { useOrigin } from "@/lib/use-origin";

export function TrackingLinkBox({
  campaignId,
  code,
}: {
  campaignId: string;
  code?: string;
}) {
  const router = useRouter();
  const origin = useOrigin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localCode, setLocalCode] = useState<string | null>(code ?? null);
  const [copied, setCopied] = useState(false);

  const trackingCode = localCode;
  const fullUrl = trackingCode ? `${origin}/t/${trackingCode}` : "";

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/creator/campaigns/${campaignId}/tracking-link`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ساخت لینک پیگیری ناموفق بود.");
        return;
      }

      setLocalCode(data.trackingLink.code);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("کپی ناموفق بود.");
    }
  }

  if (!trackingCode) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary-soft transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          <IconLink className="h-3.5 w-3.5" />
          {loading ? "در حال ساخت…" : "دریافت لینک پیگیری"}
        </button>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">کد رفرال</p>
        <span className="rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg">
          {trackingCode}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <code
          dir="ltr"
          className="min-w-0 flex-1 truncate rounded border border-line bg-bg px-2 py-1 text-[11px] text-fg"
        >
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          title="کپی لینک"
          className="shrink-0 rounded-md border border-line bg-hover p-1.5 text-fg transition-colors hover:bg-surface"
        >
          {copied ? (
            <IconCheck className="h-3.5 w-3.5 text-success" />
          ) : (
            <IconCopy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
