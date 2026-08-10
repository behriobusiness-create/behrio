import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت انجام نشده است." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "دسترسی فقط برای مدیر سیستم مجاز است." }, { status: 403 });
    }

    const [conversions, logs] = await Promise.all([
      prisma.conversion.findMany({
        where: { source: "INTEGRATION" },
        include: {
          campaign: { select: { id: true, name: true, business: { select: { companyName: true } } } },
          trackingLink: { select: { creator: { select: { displayName: true } } } },
        },
        orderBy: { occurredAt: "desc" },
        take: 50,
      }),
      prisma.apiRequestLog.findMany({
        include: {
          campaign: { select: { name: true } },
          apiKey: { select: { name: true, keyPrefix: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return NextResponse.json({ ok: true, conversions, logs });
  } catch (error) {
    console.error("Admin conversion api error:", error);
    return NextResponse.json({ error: "خطا در دریافت داده‌های Conversion API." }, { status: 500 });
  }
}