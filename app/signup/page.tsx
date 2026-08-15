"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

type Role = "CREATOR" | "BUSINESS";

const RESEND_COOLDOWN_SECONDS = 60;

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [devCode, setDevCode] = useState("");

  const [step, setStep] = useState<"identifier" | "code" | "role">(
    "identifier"
  );
  const [skipOtp, setSkipOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setDevCode("");

    if (!identifier.trim()) {
      setError("شماره موبایل یا ایمیل را وارد کنید.");
      return;
    }

    if (skipOtp) {
      setLoading(true);
      try {
        const isEmail = identifier.includes("@");
        const res = await fetch("/api/auth/signup-direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEmail ? { email: identifier } : { phone: identifier }
          ),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "ثبت‌نام ناموفق بود.");
          return;
        }

        setStep("role");
      } catch {
        setError("خطا در اتصال به سرور.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const isEmail = identifier.includes("@");
      const res = await fetch(
        isEmail ? "/api/auth/email/request-otp" : "/api/auth/send-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEmail ? { email: identifier } : { phone: identifier }
          ),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ارسال کد ناموفق بود.");
        return;
      }

      if (!isEmail && data.devCode) {
        setDevCode(data.devCode);
        setCode(data.devCode);
      }

      setStep("code");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError("کد باید ۶ رقم باشد.");
      return;
    }

    setLoading(true);

    try {
      const isEmail = identifier.includes("@");
      const res = await fetch(
        isEmail ? "/api/auth/email/verify-otp" : "/api/auth/verify-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isEmail ? { email: identifier } : { phone: identifier }),
            code,
            mode: "signup",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "کد نامعتبر است.");
        return;
      }

      if (data.newUser || data.requiresRole) {
        setStep("role");
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  async function handleChooseRole(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!role) {
      setError("نوع حساب را انتخاب کنید.");
      return;
    }

    setLoading(true);

    try {
      const isEmail = identifier.includes("@");
      const res = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEmail ? { email: identifier } : { phone: identifier }),
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "تکمیل ثبت‌نام ناموفق بود.");
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    window.location.href = "/api/auth/google";
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="rounded-2xl border border-line bg-card p-8 shadow-lg shadow-black/20">
          <h1 className="text-xl font-semibold text-fg">
            {step === "identifier" && "ساخت حساب Behrio"}
            {step === "code" && "کد تأیید را وارد کنید"}
            {step === "role" && "نوع حساب خود را انتخاب کنید"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {step === "identifier" &&
              "شماره موبایل یا ایمیل خود را وارد کنید تا کد تأیید دریافت کنید."}
            {step === "code" &&
              `کد تأیید به ${identifier} ارسال شد.`}
            {step === "role" &&
              "برای ادامه یک نوع حساب انتخاب کنید."}
          </p>

          <div className="mt-6">
            {step === "identifier" && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted">
                    شماره موبایل یا ایمیل
                  </label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثلاً 09120000000 یا you@example.com"
                    className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-right text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    dir="rtl"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                    {error}
                  </p>
                )}

                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={skipOtp}
                    onChange={(e) => setSkipOtp(e.target.checked)}
                    className="h-4 w-4 rounded border-line accent-primary"
                  />
                  ثبت‌نام سریع بدون دریافت کد تأیید
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
                >
                  {loading ? "در حال بررسی..." : skipOtp ? "ادامه" : "ارسال کد"}
                </button>
              </form>
            )}

            {step === "identifier" && (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-xs text-subtle">یا</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-hover disabled:opacity-50"
                >
                  <GoogleIcon />
                  ثبت‌نام با حساب Google
                </button>

                <p className="mt-6 text-center text-sm text-muted">
                  از قبل حساب دارید؟{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-fg underline hover:text-primary-soft"
                  >
                    وارد شوید
                  </Link>
                </p>
              </>
            )}

            {step === "code" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted">
                    کد تأیید
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    dir="ltr"
                  />
                </div>

                {devCode && (
                  <p className="rounded-xl bg-info/10 px-4 py-3 text-center text-sm font-semibold text-info">
                    کد توسعه: {devCode}
                  </p>
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
                  {loading ? "در حال بررسی..." : "ادامه"}
                </button>

                <button
                  type="button"
                  disabled={resendIn > 0}
                  onClick={handleSendOtp}
                  className="w-full text-center text-sm font-medium text-subtle transition-colors hover:text-fg disabled:cursor-not-allowed disabled:text-subtle/50"
                >
                  {resendIn > 0
                    ? `ارسال مجدد کد تا ${resendIn} ثانیه دیگر`
                    : "ارسال مجدد کد"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("identifier");
                    setCode("");
                    setError("");
                    setDevCode("");
                    setResendIn(0);
                  }}
                  className="w-full text-center text-sm font-medium text-subtle transition-colors hover:text-fg"
                >
                  تغییر شماره / ایمیل
                </button>
              </form>
            )}

            {step === "role" && (
              <form onSubmit={handleChooseRole} className="space-y-3">
                <button
                  type="button"
                  onClick={() => setRole("CREATOR")}
                  className={`flex w-full items-center justify-between rounded-xl border p-5 text-right transition ${
                    role === "CREATOR"
                      ? "border-primary bg-primary/10"
                      : "border-line bg-card hover:border-primary/40"
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-fg">
                      خالق محتوا
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      می‌خواهم با برندها همکاری کنم و درآمد کسب کنم.
                    </span>
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      role === "CREATOR"
                        ? "border-primary bg-primary"
                        : "border-line"
                    }`}
                  >
                    {role === "CREATOR" && (
                      <span className="text-[10px] text-bg">✓</span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("BUSINESS")}
                  className={`flex w-full items-center justify-between rounded-xl border p-5 text-right transition ${
                    role === "BUSINESS"
                      ? "border-primary bg-primary/10"
                      : "border-line bg-card hover:border-primary/40"
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-fg">
                      کسب‌وکار
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      می‌خواهم کمپین برگزار کنم و با خالقان محتوا همکاری کنم.
                    </span>
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      role === "BUSINESS"
                        ? "border-primary bg-primary"
                        : "border-line"
                    }`}
                  >
                    {role === "BUSINESS" && (
                      <span className="text-[10px] text-bg">✓</span>
                    )}
                  </span>
                </button>

                {error && (
                  <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !role}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
                >
                  {loading ? "در حال ذخیره..." : "ادامه"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.661 34.18 29.217 38 24 38c-7.732 0-14-6.268-14-14s6.268-14 14-14c3.57 0 6.811 1.387 9.26 3.637l5.657-5.657C35.639 3.884 30.155 1.5 24 1.5 11.85 1.5 2 11.35 2 23.5S11.85 45.5 24 45.5c11.222 0 20.625-8.13 20.625-20.02 0-1.455-.133-2.876-.382-4.235z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.57 0 6.811 1.387 9.26 3.637l5.657-5.657C35.639 3.884 30.155 1.5 24 1.5 15.078 1.5 7.58 6.624 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 45.5c5.16 0 9.86-1.97 13.409-5.192l-6.19-5.238A13.884 13.884 0 0 1 24 38c-5.185 0-9.607-3.79-10.89-8.88l-6.429 4.955C8.363 39.463 15.383 45.5 24 45.5z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 23.5c0-1.455-.133-2.876-.382-4.235z" />
    </svg>
  );
}
