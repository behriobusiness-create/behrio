import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isOtpExpired,
  MAX_OTP_ATTEMPTS,
  verifyOtpHash,
} from "@/lib/auth/otp";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { isRateLimited } from "@/lib/rate-limit";

const MAX_ATTEMPTS = MAX_OTP_ATTEMPTS;
const VERIFY_LIMIT_PER_IP = 10;
const VERIFY_LIMIT_PER_ID = 10;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const mode = body.mode === "login" ? "login" : body.mode === "signup" ? "signup" : null;

    const identifier = phone || email;

    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!identifier || !code) {
      return NextResponse.json(
        { error: "Phone or email and OTP code are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "OTP code must be 6 digits" }, { status: 400 });
    }

    const ip = clientIp(request);

    if (await isRateLimited("verify-otp-ip", ip, VERIFY_LIMIT_PER_IP, VERIFY_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    if (await isRateLimited("verify-otp-id", identifier, VERIFY_LIMIT_PER_ID, VERIFY_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone: identifier,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otp) {
      return NextResponse.json({ error: "OTP not found or already used" }, { status: 400 });
    }

    if (isOtpExpired(otp.expiresAt)) {
      return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const valid = await verifyOtpHash(code, otp.codeHash);
    if (!valid) {
      const attempts = otp.attempts + 1;
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts },
      });

      if (attempts >= MAX_ATTEMPTS) {
        await prisma.otpCode.update({
          where: { id: otp.id },
          data: { usedAt: new Date() },
        });
      }

      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    let user = null;

    if (phone) {
      user = await prisma.user.findUnique({ where: { phone } });
    }

    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (mode === "login" && !user) {
      return NextResponse.json(
        {
          error:
            "کاربری با این مشخصات پیدا نشد. اگر حساب جدید دارید، ابتدا ثبت‌نام کنید.",
        },
        { status: 404 }
      );
    }

    if (mode === "signup" && user && user.role !== null) {
      return NextResponse.json(
        {
          error:
            "این حساب از قبل وجود دارد. برای ورود به صفحه «ورود» بروید.",
        },
        { status: 409 }
      );
    }

    if (!user && phone) {
      user = await prisma.user.create({
        data: {
          phone,
          role: null,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
    }

    if (!user && email) {
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
          role: null,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiry();

    await prisma.authSession.create({
      data: {
        userId: user!.id,
        tokenHash,
        expiresAt,
      },
    });

    await setSessionCookie(sessionToken, expiresAt);

    const isNewUser = user!.role === null;

    return NextResponse.json({
      ok: true,
      newUser: isNewUser,
      requiresRole: isNewUser,
      sessionToken,
      user: {
        id: user!.id,
        phone: user!.phone,
        role: user!.role,
        status: user!.status,
      },
    });
  } catch (error) {
    console.error("Verify OTP failed:", error);
    return NextResponse.json({ error: "Unable to verify OTP" }, { status: 500 });
  }
}
