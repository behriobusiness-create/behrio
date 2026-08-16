"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

const RESEND_COOLDOWN_SECONDS = 60;

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_access_denied: "ورود با Google لغو شد.",
  google_state_mismatch: "درخواست ورود با Google معتبر نیست. دوباره تلاش کنید.",
  google_no_email: "حساب Google شما آدرس ایمیل ندارد.",
  google_auth_failed: "ورود با Google ناموفق بود. دوباره تلاش کنید.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [googleError, setGoogleError] = useState(
    GOOGLE_ERROR_MESSAGES[searchParams.get("error") ?? ""] || ""
  );

  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [password, setPassword] = useState("");
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

  function redirectByRole(role: string | null) {
    if (role === "ADMIN") {
      router.push("/admin");
    } else if (role === "BUSINESS") {
      router.push("/business");
    } else if (role === "CREATOR") {
      router.push("/creator");
    } else {
      router.push("/onboarding");
    }
    router.refresh();
  }

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setDevCode("");

    if (!identifier.trim()) {
      setError("شماره موبایل یا ایمیل را وارد کنید.");
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
            mode: "login",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "کد نامعتبر است.");
        return;
      }

      redirectByRole(data.user?.role ?? null);
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setGoogleError("");
    window.location.href = "/api/auth/google";
  }

  async function handlePasswordLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError("شماره موبایل یا ایمیل را وارد کنید.");
      return;
    }
    if (!password) {
      setError("رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const isEmail = value.includes("@");
      const res = await fetch(
        isEmail ? "/api/auth/login-password" : "/api/auth/login-password-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEmail ? { email: value, password } : { phone: value, password }
          ),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ورود ناموفق بود.");
        return;
      }

      redirectByRole(data.user?.role ?? null);
    } catch {
      setError("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="rounded-2xl border border-line bg-card p-8 shadow-lg shadow-black/20">
          <h1 className="text-xl font-semibold text-fg">
            {step === "identifier" && "ورود به Behrio"}
            {step === "code" && "کد تأیید را وارد کنید"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {step === "identifier" &&
              (method === "otp"
                ? "شماره موبایل یا ایمیل حساب خود را وارد کنید."
                : "با شماره موبایل یا ایمیل و رمز عبور خود وارد شوید.")}
            {step === "code" &&
              `کد تأیید به ${identifier} ارسال شد.`}
          </p>

          <div className="mt-6">
            {step === "identifier" && (
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-hover p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("otp");
                    setError("");
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    method === "otp"
                      ? "bg-hover text-fg"
                      : "text-subtle hover:text-fg"
                  }`}
                >
                  کد یکبارمصرف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("password");
                    setError("");
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    method === "password"
                      ? "bg-hover text-fg"
                      : "text-subtle hover:text-fg"
                  }`}
                >
                  ایمیل/شماره و رمز عبور
                </button>
              </div>
            )}

            {step === "identifier" && method === "otp" && (
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
                >
                  {loading ? "در حال ارسال..." : "ارسال کد"}
                </button>
              </form>
            )}

            {step === "identifier" && method === "password" && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
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

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted">
                    رمز عبور
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-right text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    dir="ltr"
                  />
                </div>

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
                  {loading ? "در حال ورود..." : "ورود"}
                </button>

                <p className="text-center text-xs text-subtle">
                  رمز عبور ندارید؟ با «کد یکبارمصرف» وارد شوید و بعداً در
                  تنظیمات رمز بسازید.
                </p>
              </form>
            )}

            {step === "identifier" && (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-xs text-subtle">یا</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                {googleError && (
                  <p className="mb-3 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                    {googleError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-hover disabled:opacity-50"
                >
                  <GoogleIcon />
                  ادامه با حساب Google
                </button>

                <p className="mt-6 text-center text-sm text-muted">
                  حساب ندارید؟{" "}
                  <Link
                    href="/signup"
                    className="font-semibold text-fg underline hover:text-primary-soft"
                  >
                    ثبت‌نام کنید
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
                  {loading ? "در حال بررسی..." : "تأیید و ورود"}
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
