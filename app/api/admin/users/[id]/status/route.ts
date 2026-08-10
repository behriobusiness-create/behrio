import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserStatus } from "@/app/generated/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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
        { error: "دسترسی فقط برای مدیر سیستم مجاز است." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    if (id === user.id) {
      return NextResponse.json(
        { error: "نمی‌توانید وضعیت حساب خودتان را تغییر دهید." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const status = body.status;

    if (status !== "ACTIVE" && status !== "SUSPENDED") {
      return NextResponse.json(
        { error: "وضعیت نامعتبر است." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });

    if (!target) {
      return NextResponse.json(
        { error: "کاربر پیدا نشد." },
        { status: 404 }
      );
    }

    if (target.role === "ADMIN") {
      return NextResponse.json(
        { error: "نمی‌توانید وضعیت مدیران را تغییر دهید." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: status as UserStatus },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error("Admin user status error:", error);
    return NextResponse.json(
      { error: "تغییر وضعیت کاربر ناموفق بود." },
      { status: 500 }
    );
  }
}
