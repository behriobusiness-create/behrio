import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateOtp, getOtpExpiry, hashOtp } from "@/lib/auth/otp";
import { isRateLimited } from "@/lib/rate-limit";
import { sendOtpEmail } from "@/lib/mail";

const SEND_OTP_LIMIT_PER_IP = 10;
const SEND_OTP_LIMIT_PER_ID = 3;
const SEND_OTP_WINDOW_MS = 10 * 60 * 1000;

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

    if (!phone && !email) {
      return NextResponse.json({ error: "Phone or email is required" }, { status: 400 });
    }

    const ip = clientIp(request);

    if (await isRateLimited("send-otp-ip", ip, SEND_OTP_LIMIT_PER_IP, SEND_OTP_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const identifier = phone || email;

    if (await isRateLimited("send-otp-id", identifier, SEND_OTP_LIMIT_PER_ID, SEND_OTP_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing && existing.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "این حساب غیرفعال است." },
          { status: 403 }
        );
      }
    }

    const code = generateOtp();
    const codeHash = await hashOtp(code);

    await prisma.$transaction([
      prisma.otpCode.deleteMany({
        where: { phone: identifier, usedAt: null },
      }),
      prisma.otpCode.create({
        data: {
          phone: identifier,
          codeHash,
          expiresAt: getOtpExpiry(),
        },
      }),
    ]);

    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
      console.log("OTP CODE:", code);
    } else if (email) {
      const sent = await sendOtpEmail(email, code);
      if (!sent) {
        console.error("Email OTP send failed. No delivery mechanism configured.");
      }
    } else {
      console.error(
        "SMS OTP delivery is not configured; cannot deliver code in production."
      );
    }

    return NextResponse.json({
      ok: true,
      message: "OTP sent",
      ...(isDev ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("Send OTP failed:", error);
    return NextResponse.json({ error: "Unable to send OTP" }, { status: 500 });
  }
}
