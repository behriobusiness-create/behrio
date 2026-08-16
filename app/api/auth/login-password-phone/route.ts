import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { isRateLimited } from "@/lib/rate-limit";

const LOGIN_LIMIT = 20;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, "");
}

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

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!phone || !password) {
      return NextResponse.json(
        { error: "شماره موبایل و رمز عبور الزامی است." },
        { status: 400 }
      );
    }

    const ip = clientIp(request);

    if (await isRateLimited("login-password-phone-ip", ip, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
      return NextResponse.json(
        { error: "تلاش زیاد. بعداً دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    if (await isRateLimited("login-password-phone", phone, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
      return NextResponse.json(
        { error: "تلاش زیاد. بعداً دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "شماره موبایل یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { error: "شماره موبایل یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "این حساب غیرفعال است." },
        { status: 403 }
      );
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

    return NextResponse.json({
      ok: true,
      sessionToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Phone password login failed:", error);
    return NextResponse.json(
      { error: "ورود با رمز عبور ناموفق بود." },
      { status: 500 }
    );
  }
}