import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_STATUSES = ["VERIFIED", "REJECTED"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await getCurrentUser();

    if (!admin) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "دسترسی فقط برای مدیر سیستم مجاز است." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const body = await request.json();
    const status = body.status as string;

    if (!VALID_STATUSES.includes(status as never)) {
      return NextResponse.json(
        { error: "وضعیت نامعتبر است." },
        { status: 400 }
      );
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";

    const profile = await prisma.creatorProfile.findFirst({ where: { id } });

    if (!profile) {
      return NextResponse.json(
        { error: "پروفایل خالق محتوا پیدا نشد." },
        { status: 404 }
      );
    }

    const updated = await prisma.creatorProfile.update({
      where: { id },
      data: {
        verificationStatus: status,
        verificationData: {
          ...(typeof profile.verificationData === "object" &&
          profile.verificationData !== null
            ? (profile.verificationData as Record<string, unknown>)
            : {}),
          status,
          reviewedAt: new Date().toISOString(),
          reviewedBy: admin.id,
          ...(note ? { note } : {}),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      verificationStatus: updated.verificationStatus,
    });
  } catch (error) {
    console.error("Admin creator verification error:", error);
    return NextResponse.json(
      { error: "تغییر وضعیت تایید خالق محتوا ناموفق بود." },
      { status: 500 }
    );
  }
}