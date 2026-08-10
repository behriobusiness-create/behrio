"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { labelClass, inputClass } from "@/components/ui";

export default function CreateCampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("CPC");
  const [budget, setBudget] = useState("");
  const [rewardPerClick, setRewardPerClick] = useState("");
  const [rewardPerConversion, setRewardPerConversion] = useState("");
  const [rewardPerThousand, setRewardPerThousand] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [clickGroupSize, setClickGroupSize] = useState("1");
  const [conversionGoal, setConversionGoal] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [accessType, setAccessType] = useState("OPEN");

  const typeExplanations: Record<string, string> = {
    CPC: "پرداخت به‌ازای کلیک: به‌ازای هر {Y} کلیک، مبلغ {X} تومان به خالق محتوا پرداخت می‌شود. برای جذب بازدید مناسب است.",
    CPA: "پرداخت به‌ازای کلیک (مانند CPC): به‌ازای هر {Y} کلیک، مبلغ {X} تومان پرداخت می‌شود.",
    CPM: "پرداخت به‌ازای نمایش: به‌ازای هر ۱۰۰۰ نمایش (ویو) محتوا، پاداش مشخصی پرداخت می‌شود. مناسب برندینگ.",
    AFFILIATE: "همکاری در فروش: خالق محتوا به‌ازای هر فروشی که از لینک او انجام شود، درصدی از مبلغ فروش را کمیسیون دریافت می‌کند.",
    CLIPPING: "کلیپ: خالقان محتوا کلیپ برند شما را منتشر می‌کنند و به‌ازای هر ۱۰۰۰ نمایش (ویو) پاداش می‌گیرند.",
  };

  const typeRewardHint: Record<string, { click?: boolean; thousand?: boolean; percent?: boolean }> = {
    CPC: { click: true },
    CPA: { click: true },
    CPM: { thousand: true },
    AFFILIATE: { percent: true },
    CLIPPING: { thousand: true },
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload: Record<string, unknown> = {
      name,
      description,
      type,
      accessType,
      budget: Number(budget),
      destinationUrl,
    };

    if (type === "CPC" || type === "CPA") {
      payload.rewardPerClick = Number(rewardPerClick);
      payload.clickRewardPerGroup = Number(clickGroupSize) || 1;
    }
    if (type === "CPM" || type === "CLIPPING") {
      payload.rewardPerThousand = Number(rewardPerThousand);
    }
    if (rewardPerConversion) payload.rewardPerConversion = Number(rewardPerConversion);
    if (type === "AFFILIATE" && commissionPercent)
      payload.commissionPercent = Number(commissionPercent);
    if (conversionGoal) payload.conversionGoal = Number(conversionGoal);

    setLoading(true);

    try {
      const res = await fetch("/api/business/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.wallet) {
          setError(
            `${data.error} موجودی فعلی: ${new Intl.NumberFormat("fa-IR").format(data.wallet.available)} تومان.`
          );
        } else {
          setError(data.error || "ایجاد کمپین ناموفق بود.");
        }
        return;
      }

      setSuccess("کمپین ایجاد شد و در انتظار تأیید مدیر است.");
      setName("");
      setDescription("");
      setBudget("");
      setRewardPerClick("");
      setRewardPerConversion("");
      setRewardPerThousand("");
      setCommissionPercent("");
      setClickGroupSize("1");
      setConversionGoal("");
      setDestinationUrl("");
      setType("CPC");
      setAccessType("OPEN");
      setOpen(false);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright"
        >
          کمپین جدید
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>نام کمپین</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="مثلاً فروش تابستانه"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>نوع کمپین</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClass}
              >
                <option value="CPC">CPC (پرداخت به ازای کلیک)</option>
                <option value="CPA">CPA (پرداخت گروهی به ازای کلیک)</option>
                <option value="CPM">CPM (پرداخت به ازای نمایش)</option>
                <option value="AFFILIATE">وابسته (Affiliate)</option>
                <option value="CLIPPING">کلیپ (Clipping)</option>
              </select>
              <div className="mt-2 rounded-lg border border-info/25 bg-info/10 px-3 py-2.5">
                <p className="text-xs font-semibold text-info">
                  {type} چطور کار می‌کند؟
                </p>
                <p className="mt-1 text-xs leading-5 text-info/90">
                  {typeExplanations[type]}
                </p>
              </div>
              {typeRewardHint[type]?.click && (
                <p className="mt-1.5 text-xs text-subtle">
                  مبلغ پاداش (X) و تعداد کلیک هر گروه (Y) را تعیین کنید.
                </p>
              )}
              {typeRewardHint[type]?.thousand && (
                <p className="mt-1.5 text-xs text-subtle">
                  پاداش به‌ازای هر ۱۰۰۰ نمایش (ویو) را حتماً تعیین کنید.
                </p>
              )}
              {typeRewardHint[type]?.percent && (
                <p className="mt-1.5 text-xs text-subtle">
                  درصد کمیسیون از مبلغ هر فروش را تعیین کنید.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>بودجه (تومان)</label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
                inputMode="numeric"
                placeholder="مثلاً 5000000"
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelClass}>نوع دسترسی</label>
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value)}
                className={inputClass}
              >
                <option value="OPEN">باز (همه تولیدکنندگان)</option>
                <option value="APPROVAL_REQUIRED">نیازمند تأیید کسب‌وکار</option>
                <option value="HYBRID">ترکیبی</option>
              </select>
            </div>
            {(type === "CPC" || type === "CPA") && (
              <>
                <div>
                  <label className={labelClass}>مبلغ پاداش هر گروه (X) تومان</label>
                  <input
                    value={rewardPerClick}
                    onChange={(e) => setRewardPerClick(e.target.value)}
                    required
                    inputMode="numeric"
                    placeholder="مثلاً ۵۰۰۰۰"
                    className={inputClass}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelClass}>تعداد کلیک هر گروه (Y)</label>
                  <input
                    value={clickGroupSize}
                    onChange={(e) => setClickGroupSize(e.target.value)}
                    required
                    inputMode="numeric"
                    placeholder="مثلاً ۱۰۰"
                    className={inputClass}
                    dir="ltr"
                  />
                  <p className="mt-1.5 text-xs text-subtle">
                    هر {clickGroupSize || "Y"} کلیک جمع شود، {rewardPerClick || "X"} تومان پرداخت می‌شود.
                  </p>
                </div>
              </>
            )}
            {(type === "CPM" || type === "CLIPPING") && (
              <div>
                <label className={labelClass}>پاداش به‌ازای هر ۱۰۰۰ نمایش/ویو (تومان)</label>
                <input
                  value={rewardPerThousand}
                  onChange={(e) => setRewardPerThousand(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="مثلاً ۲۰۰۰۰۰"
                  className={inputClass}
                  dir="ltr"
                />
              </div>
            )}
            {type === "AFFILIATE" && (
              <div>
                <label className={labelClass}>درصد کمیسیون از فروش (٪)</label>
                <input
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="مثلاً ۱۵"
                  className={inputClass}
                  dir="ltr"
                />
                <p className="mt-1.5 text-xs text-subtle">
                  خالق به‌ازای هر فروش، {commissionPercent || "X"}٪ از مبلغ فروش را کمیسیون می‌گیرد.
                </p>
              </div>
            )}
            <div>
              <label className={labelClass}>هدف تعداد تبدیل (اختیاری)</label>
              <input
                value={conversionGoal}
                onChange={(e) => setConversionGoal(e.target.value)}
                inputMode="numeric"
                placeholder="مثلاً ۵۰"
                className={inputClass}
                dir="ltr"
              />
              <p className="mt-1.5 text-xs text-subtle">
                با رسیدن به این تعداد تبدیل، کمپین به‌صورت خودکار تکمیل و تسویه می‌شود.
              </p>
            </div>
          </div>

          <div>
            <label className={labelClass}>آدرس مقصد</label>
            <input
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              required
              placeholder="https://example.com"
              className={inputClass}
              dir="ltr"
            />
          </div>

          <div>
            <label className={labelClass}>توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="کمپین را برای تولیدکنندگان توضیح دهید..."
              className={`${inputClass} min-h-24 resize-none`}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary-soft">
              {success}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
            >
              {loading ? "در حال ایجاد..." : "ایجاد کمپین"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-hover"
            >
              انصراف
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
