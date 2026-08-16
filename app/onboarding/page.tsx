"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { labelClass, inputClass } from "@/components/ui";
import { IconUpload, IconCheck, IconX } from "@/components/icons";

type Role = "CREATOR" | "BUSINESS";

export default function OnboardingPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [instagramScreenshot, setInstagramScreenshot] = useState("");
  const [uploading, setUploading] = useState(false);
  const instagramFileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleInstagramUpload(event: React.ChangeEvent<HTMLInputElement>) {
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
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "آپلود ناموفق بود.");
        return;
      }

      setInstagramScreenshot(data.url);
    } catch {
      setError("خطا در خواندن تصویر.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!role) {
      setError("لطفاً یک نوع حساب انتخاب کنید.");
      return;
    }

    if (role === "CREATOR" && !instagramHandle.trim()) {
      setError("آدرس اینستاگرام الزامی است.");
      return;
    }

    if (role === "CREATOR" && !instagramScreenshot) {
      setError("آپلود اسکرین‌شات اینستاگرام الزامی است.");
      return;
    }

    setLoading(true);
    setError("");

    const payload =
      role === "CREATOR"
        ? { role, displayName, bio, instagramHandle, instagramScreenshotUrl: instagramScreenshot }
        : { role, companyName, website, description };

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "تکمیل مشخصات ناموفق بود.");
        return;
      }

      if (role === "CREATOR") router.push("/creator");
      else router.push("/business");
      router.refresh();
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="rounded-2xl border border-line bg-card p-8 shadow-lg shadow-black/20">
          <h1 className="text-xl font-semibold text-fg">
            به Behrio خوش آمدید
          </h1>
          <p className="mt-1 text-sm text-muted">
            برای شروع، مشخصات خود را تکمیل کنید.
          </p>

          <div className="mt-6">
            {!role ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setRole("CREATOR")}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-card p-5 text-right transition hover:border-primary/40"
                >
                  <span>
                    <span className="block font-semibold text-fg">
                      خالق محتوا
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      من محتوا تولید می‌کنم و می‌خواهم با برندها همکاری کنم.
                    </span>
                  </span>
                  <span className="text-subtle">←</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("BUSINESS")}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-card p-5 text-right transition hover:border-primary/40"
                >
                  <span>
                    <span className="block font-semibold text-fg">
                      کسب‌وکار
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      من کسب‌وکار دارم و می‌خواهم کمپین برگزار کنم.
                    </span>
                  </span>
                  <span className="text-subtle">←</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setRole(null);
                    setError("");
                  }}
                  className="text-sm font-medium text-subtle transition-colors hover:text-fg"
                >
                  → بازگشت به انتخاب نوع حساب
                </button>

                {role === "CREATOR" ? (
                  <>
                    <div>
                      <label className={labelClass}>نام نمایشی</label>
                      <input
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        required
                        placeholder="مثلاً علی رضایی"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>درباره من</label>
                      <textarea
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="کمی درباره خودتان بنویسید..."
                        className={`${inputClass} min-h-28 resize-none`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>اینستاگرام</label>
                      <input
                        value={instagramHandle}
                        onChange={(event) => setInstagramHandle(event.target.value)}
                        required
                        placeholder="@username"
                        className={inputClass}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>اسکرین‌شات اینستاگرام</label>
                      <input
                        ref={instagramFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleInstagramUpload}
                        className="hidden"
                      />
                      {instagramScreenshot ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={instagramScreenshot}
                            alt="پیش‌نمایش اسکرین‌شات اینستاگرام"
                            className="h-16 w-16 rounded-xl border border-line object-cover"
                          />
                          <span className="text-sm text-success">
                            <IconCheck className="ml-1 inline h-4 w-4" />
                            آپلود شد
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setInstagramScreenshot("");
                              if (instagramFileRef.current) instagramFileRef.current.value = "";
                            }}
                            className="text-xs font-medium text-danger"
                          >
                            حذف
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => instagramFileRef.current?.click()}
                          disabled={uploading}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-sm text-muted transition-colors hover:border-primary hover:text-fg disabled:opacity-50"
                        >
                          <IconUpload className="h-4 w-4" />
                          {uploading ? "در حال آپلود…" : "انتخاب و آپلود اسکرین‌شات اینستاگرام"}
                        </button>
                      )}
                      <p className="mt-1.5 text-xs text-subtle">
                        از پروفایل اینستاگرام خود اسکرین‌شات بگیرید (شامل نام کاربری و آمار).
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className={labelClass}>نام شرکت</label>
                      <input
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        required
                        placeholder="مثلاً فروشگاه دیجیتال"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>وب‌سایت</label>
                      <input
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        placeholder="https://example.com"
                        className={inputClass}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>درباره کسب‌وکار</label>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="کسب‌وکار خود را توصیف کنید..."
                        className={`${inputClass} min-h-28 resize-none`}
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
                >
                  {loading ? "در حال ذخیره..." : "تکمیل ثبت‌نام"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
