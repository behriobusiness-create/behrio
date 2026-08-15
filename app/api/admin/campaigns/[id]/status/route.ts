import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { CampaignStatus } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { settleReservedIfTerminal } from "@/lib/wallet";

type RouteContext = {
params: Promise<{ id: string }>;
};

export async function PATCH(
request: Request,
context: RouteContext,
) {
try {
const user = await getCurrentUser();


if (!user) {
  return NextResponse.json(
    { error: "احراز هویت انجام نشده است." },
    { status: 401 },
  );
}

if (user.role !== "ADMIN") {
  return NextResponse.json(
    { error: "دسترسی فقط برای مدیر سیستم مجاز است." },
    { status: 403 },
  );
}

const { id } = await context.params;

const body = await request.json();
const { status: requestedStatus } = body;

if (!requestedStatus || typeof requestedStatus !== "string") {
  return NextResponse.json(
    { error: "وضعیت جدید الزامی است." },
    { status: 400 },
  );
}

if (
  requestedStatus !== "ACTIVE" &&
  requestedStatus !== "CANCELLED"
) {
  return NextResponse.json(
    { error: "وضعیت بررسی کمپین نامعتبر است." },
    { status: 400 },
  );
}

const campaign = await prisma.campaign.findUnique({
  where: {
    id,
  },
  select: {
    id: true,
    status: true,
  },
});

if (!campaign) {
  return NextResponse.json(
    { error: "کمپین پیدا نشد." },
    { status: 404 },
  );
}

if (campaign.status !== "PENDING_REVIEW") {
  return NextResponse.json(
    {
      error:
        "فقط کمپین‌های در انتظار بررسی می‌توانند بررسی شوند.",
    },
    { status: 400 },
  );
}

const updatedCampaign = await prisma.$transaction(async (tx) => {
  const updated = await tx.campaign.update({
    where: {
      id: campaign.id,
    },
    data: {
      status: requestedStatus as CampaignStatus,
    },
  });

  await settleReservedIfTerminal(tx, campaign.id);

  return updated;
});

return NextResponse.json({
  ok: true,
  campaign: updatedCampaign,
});


} catch (error) {
console.error("Admin campaign review error:", error);


return NextResponse.json(
  { error: "بررسی کمپین با خطا مواجه شد." },
  { status: 500 },
);


}
}

