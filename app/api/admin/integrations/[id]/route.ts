import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateClickId } from "@/lib/integrations/keys";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت انجام نشده است." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "دسترسی فقط برای مدیر سیستم مجاز است." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    if (action !== "APPROVE" && action !== "REJECT" && action !== "DISABLE" && action !== "ENABLE") {
      return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
    }

    const integration = await prisma.campaignIntegration.findUnique({ where: { id } });
    if (!integration) {
      return NextResponse.json({ error: "یکپارچه‌سازی پیدا نشد." }, { status: 404 });
    }

    if (action === "APPROVE") {
      const now = new Date();
      const updated = await prisma.campaignIntegration.update({
        where: { id },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
          lastVerifiedAt: now,
          verifiedBy: user.id,
          verificationMeta: { method: "admin-approve" },
        },
      });
      return NextResponse.json({ ok: true, integration: updated });
    }

    if (action === "REJECT") {
      const updated = await prisma.campaignIntegration.update({
        where: { id },
        data: {
          status:
            integration.status === "VERIFICATION_PENDING" ? "FAILED" : integration.status,
        },
      });
      return NextResponse.json({ ok: true, integration: updated });
    }

    if (action === "DISABLE") {
      const updated = await prisma.campaignIntegration.update({
        where: { id },
        data: { status: "DISABLED" },
      });
      return NextResponse.json({ ok: true, integration: updated });
    }

    const updated = await prisma.campaignIntegration.update({
      where: { id },
      data: { status: "VERIFICATION_PENDING", testClickId: generateClickId(true) },
    });
    return NextResponse.json({
      ok: true,
      integration: updated,
      message: "یکپارچه‌سازی مجدداً فعال شد؛ در انتظار تأیید دوباره است.",
    });
  } catch (error) {
    console.error("Admin integration action error:", error);
    return NextResponse.json({ error: "خطا در اعمال عملیات بر یکپارچه‌سازی." }, { status: 500 });
  }
}