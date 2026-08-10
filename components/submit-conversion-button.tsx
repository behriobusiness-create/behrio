"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconUpload, IconX, IconTarget, IconCheck } from "@/components/icons";
import { useOrigin } from "@/lib/use-origin";

type CampaignOption = {
  id: string;
  name: string;
  code: string;
};

export function SubmitConversionButton({
  campaigns,
}: {
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const origin = useOrigin();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [screenshot, setScreenshot] = useState("");

  const selected = campaigns.find((c) => c.id === campaignId);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("فقط PNG، JPG یا WEBP مجاز است.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم تصویر باید کمتر از ۵ مگابایت باشد.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read-error"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "آپلود ناموفق بود.");
        return;
      }

      setScreenshot(data.url);
    } catch {
      setError("خطا در خواندن تصویر.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const selectedCampaign = campaigns.find((c) => c.id === campaignId);
    if (!selectedCampaign) {
      setError("یک کمپین انتخاب کنید.");
      return;
    }
    if (!screenshot) {
      setError("آپلود اسکرین‌شات به عنوان مدرک الزامی است.");
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        trackingLinkCode: selectedCampaign.code,
        screenshot,
      };
      if (amount) payload.amount = Number(amount);
      if (externalOrderId.trim()) payload.externalOrderId = externalOrderId.trim();

      const res = await fetch("/api/conversions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ثبت تبدیل ناموفق بود.");
        return;
      }

      setSuccess("تبدیل ثبت شد و در انتظار تأیید است.");
      setAmount("");
      setExternalOrderId("");
      setScreenshot("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
          setSuccess("");
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-primary-bright"
      >
        <IconTarget className="h-3.5 w-3.5" />
        ثبت تبدیل + اسکرین‌شات
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => (loading || uploading ? null : setOpen(false))}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-fg">ثبت تبدیل</h3>
                <p className="mt-1 text-xs text-subtle">
                  تبدیل را همراه با مدرک (اسکرین‌شات) ثبت کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                  setSuccess("");
                }}
                className="rounded-lg p-1 text-subtle transition-colors hover:bg-hover hover:text-fg"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  کمپین
                </label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-primary focus:outline-none"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selected && (
                  <p className="mt-1.5 truncate font-mono text-[11px] text-subtle" dir="ltr">
                    {`${origin}/t/${selected.code}`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">
                    مبلغ (تومان)
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="اختیاری"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">
                    شناسه سفارش
                  </label>
                  <input
                    value={externalOrderId}
                    onChange={(e) => setExternalOrderId(e.target.value)}
                    placeholder="اختیاری"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  اسکرین‌شات مدرک
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUpload}
                  className="hidden"
                />
                {screenshot ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={screenshot}
                      alt="پیش‌نمایش"
                      className="h-16 w-16 rounded-lg border border-line object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshot("");
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-xs font-medium text-danger"
                    >
                      حذف
                    </button>
                    <span className="text-xs text-success">آپلود شد</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-6 text-xs text-muted transition-colors hover:border-primary hover:text-fg disabled:opacity-50"
                  >
                    <IconUpload className="h-4 w-4" />
                    {uploading ? "در حال آپلود…" : "انتخاب و آپلود اسکرین‌شات"}
                  </button>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-xs text-success">
                  <IconCheck className="ml-1 inline h-3.5 w-3.5" />
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || uploading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "در حال ثبت…" : "ثبت تبدیل"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
