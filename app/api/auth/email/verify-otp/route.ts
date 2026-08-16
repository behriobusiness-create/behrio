import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, passwordStrengthIssues, hashPassword } from "@/lib/auth/password";
import {
  isEmailOtpExpired,
  MAX_EMAIL_OTP_ATTEMPTS,
  verifyEmailOtp,
} from "@/lib/auth/email-otp";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { isRateLimited } from "@/lib/rate-limit";

const VERIFY_LIMIT_PER_EMAIL = 12;
const VERIFY_LIMIT_PER_IP = 60;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "درخواست نامعتبر است." },
        { status: 400 }
      );
    }

    const rawEmail =
      typeof (body as { email?: unknown })?.email === "string"
        ? ((body as { email: string }).email as string)
        : "";
    const email = normalizeEmail(rawEmail);

    const code = typeof (body as { code?: unknown })?.code === "string"
      ? ((body as { code: string }).code as string).trim()
      : "";

    const password =
      typeof (body as { password?: unknown })?.password === "string"
        ? ((body as { password: string }).password as string)
        : "";

    const mode =
      (body as { mode?: unknown })?.mode === "login"
        ? "login"

        : (body as { mode?: unknown })?.mode === "signup"
          ? "signup"
          : null;

    if (mode === "signup" && !password) {
      return NextResponse.json(
        { error: "رمز عبور الزامی است." },
        { status: 400 }
      );
    }

    const strengthIssue = mode === "signup" ? passwordStrengthIssues(password) : null;
    if (strengthIssue) {
      return NextResponse.json({ error: strengthIssue }, { status: 400 });
    }

    if (!email || !EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "ایمیل یا کد تأیید نامعتبر است." },
        { status: 400 }
      );
    }

    if (!mode) {
      return NextResponse.json(
        { error: "حالت ورود نامعتبر است." },
        { status: 400 }
      );
    }

    const ip = clientIp(request);

    if (await isRateLimited("email-otp-verify-ip", ip, VERIFY_LIMIT_PER_IP, VERIFY_WINDOW_MS)) {
      return NextResponse.json(
        { error: "تلاش‌های زیاد است. بعداً دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    if (
      await isRateLimited(
        "email-otp-verify-email",
        email,
        VERIFY_LIMIT_PER_EMAIL,
        VERIFY_WINDOW_MS
      )
    ) {
      return NextResponse.json(
        { error: "تلاش‌های زیاد است. بعداً دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    const otp = await prisma.emailOtp.findFirst({
      where: {
        email,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "کد تأیید معتبر نیست. دوباره درخواست دهید." },
        { status: 400 }
      );
    }

    if (isEmailOtpExpired(otp.expiresAt)) {
      return NextResponse.json(
        { error: "کد تأیید منقضی شده است. دوباره درخواست دهید." },
        { status: 400 }
      );
    }

    if (otp.attempts >= MAX_EMAIL_OTP_ATTEMPTS) {
      return NextResponse.json(
        { error: "تلاش‌های زیاد است. کد را دوباره درخواست دهید." },
        { status: 429 }
      );
    }

    const valid = await verifyEmailOtp(code, otp.codeHash);

    if (!valid) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      return NextResponse.json(
        { error: "کد تأیید نادرست است." },
        { status: 400 }
      );
    }

    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    let user = await prisma.user.findUnique({ where: { email } });

    if (mode === "login" && !user) {
      return NextResponse.json(
        {
          error:
            "کاربری با این ایمیل پیدا نشد. اگر حساب جدید دارید، ابتدا ثبت‌نام کنید.",
        },
        { status: 404 }
      );
    }

    if (mode === "signup" && user && user.role !== null) {
      return NextResponse.json(
        {
          error: "این حساب از قبل وجود دارد. برای ورود به صفحه «ورود» بروید.",
        },
        { status: 409 }
      );
    }

    if (user && user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "این حساب غیرفعال است." },
        { status: 403 }
      );
    }

    if (!user) {
      const passwordHash = mode === "signup" ? await hashPassword(password) : null;
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
          role: null,
          passwordHash,
        },
      });
    } else if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiry();

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await setSessionCookie(sessionToken, expiresAt);

    const isNewUser = user.role === null;

    return NextResponse.json({
      ok: true,
      newUser: isNewUser,
      requiresRole: isNewUser,
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Email OTP verify failed:", error);
    return NextResponse.json(
      { error: "بررسی کد ناموفق بود." },
      { status: 500 }
    );
  }
}