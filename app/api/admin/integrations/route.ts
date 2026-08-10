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

    const integrations = await prisma.campaignIntegration.findMany({
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            business: { select: { companyName: true } },
          },
        },
        user: { select: { email: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ ok: true, integrations });
  } catch (error) {
    console.error("Admin integrations error:", error);
    return NextResponse.json({ error: "خطا در دریافت فهرست یکپارچه‌سازی‌ها." }, { status: 500 });
  }
}