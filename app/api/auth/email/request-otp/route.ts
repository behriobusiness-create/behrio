import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/password";
import {
  generateEmailOtp,
  getEmailOtpExpiry,
  hashEmailOtp,
} from "@/lib/auth/email-otp";
import { isRateLimited } from "@/lib/rate-limit";
import { sendOtpEmail } from "@/lib/mail";

const SEND_LIMIT_PER_EMAIL = 6;
const SEND_LIMIT_PER_IP = 30;
const SEND_WINDOW_MS = 10 * 60 * 1000;

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

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "آدرس ایمیل معتبر نیست." },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return NextResponse.json(
        { error: "آدرس ایمیل معتبر نیست." },
        { status: 400 }
      );
    }

    const ip = clientIp(request);

    if (await isRateLimited("email-otp-ip", ip, SEND_LIMIT_PER_IP, SEND_WINDOW_MS)) {
      return NextResponse.json(
        { error: "درخواست‌های زیاد. بعداً دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    if (
      await isRateLimited(
        "email-otp-email",
        email,
        SEND_LIMIT_PER_EMAIL,
        SEND_WINDOW_MS
      )
    ) {
      return NextResponse.json(
        { error: "درخواست‌های زیاد است. لحظاتی بعد دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    const code = generateEmailOtp();
    const codeHash = await hashEmailOtp(code);

    await prisma.$transaction([
      prisma.emailOtp.deleteMany({
        where: { email, usedAt: null },
      }),
      prisma.emailOtp.create({
        data: {
          email,
          codeHash,
          expiresAt: getEmailOtpExpiry(),
        },
      }),
    ]);

    const sent = await sendOtpEmail(email, code);

    if (!sent && process.env.NODE_ENV !== "production") {
      console.log(`[email-otp:dev] ${email} -> ${code}`);
    }

    return NextResponse.json({
      ok: true,
      message: "کد تأیید ارسال شد.",
    });
  } catch (error) {
    console.error("Email OTP request failed:", error);
    return NextResponse.json(
      { error: "ارسال کد ناموفق بود." },
      { status: 500 }
    );
  }
}