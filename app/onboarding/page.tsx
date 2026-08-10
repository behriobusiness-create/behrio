"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { labelClass, inputClass } from "@/components/ui";

type Role = "CREATOR" | "BUSINESS";

export default function OnboardingPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!role) {
      setError("لطفاً یک نوع حساب انتخاب کنید.");
      return;
    }

    setLoading(true);
    setError("");

    const payload =
      role === "CREATOR"
        ? { role, displayName, bio, instagramHandle }
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
                        placeholder="@username"
                        className={inputClass}
                        dir="ltr"
                      />
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
