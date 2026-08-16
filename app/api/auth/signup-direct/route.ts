import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { hashPassword, passwordStrengthIssues, normalizeEmail } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!phone && !email) {
      return NextResponse.json(
        { error: "شماره موبایل یا ایمیل الزامی است." },
        { status: 400 }
      );
    }

    let strengthIssue: string | null = null;
    if (password) {
      strengthIssue = passwordStrengthIssues(password);
    } else if (email) {
      strengthIssue = "رمز عبور الزامی است.";
    }

    if (strengthIssue) {
      return NextResponse.json({ error: strengthIssue }, { status: 400 });
    }

    let user = null;
    if (phone) user = await prisma.user.findUnique({ where: { phone } });
    if (!user && email) user = await prisma.user.findUnique({ where: { email } });

    if (user && user.status !== "ACTIVE") {
      return NextResponse.json({ error: "این حساب غیرفعال است." }, { status: 403 });
    }

    if (user) {
      if (user.email && email && user.passwordHash && user.role !== null) {
        return NextResponse.json(
          {
            error:
              "این حساب از قبل وجود دارد. برای ورود به صفحه «ورود» بروید.",
          },
          { status: 409 }
        );
      }
      if (email && !user.email) {
        return NextResponse.json(
          { error: "این حساب از قبل وجود دارد. برای ورود به صفحه «ورود» بروید." },
          { status: 409 }
        );
      }
    }

    const passwordHash = password ? await hashPassword(password) : null;

    if (!user) {
      user = await prisma.user.create({
        data: email
          ? { email, emailVerified: new Date(), role: null, passwordHash }
          : { phone, role: null, passwordHash },
      });
    } else {
      if (!user.passwordHash && passwordHash) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
      }
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
        email: user!.email,
        role: user!.role,
        status: user!.status,
      },
    });
  } catch (error) {
    console.error("Direct signup failed:", error);
    return NextResponse.json({ error: "ثبت‌نام ناموفق بود." }, { status: 500 });
  }
}
