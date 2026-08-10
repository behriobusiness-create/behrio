import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "دسترسی فقط برای Admin مجاز است." },
        { status: 403 }
      );
    }

    const campaigns = await prisma.campaign.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        business: {
          select: {
            companyName: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      campaigns,
    });
  } catch (error) {
    console.error("Admin campaigns error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت کمپین‌ها." },
      { status: 500 }
    );
  }
}
