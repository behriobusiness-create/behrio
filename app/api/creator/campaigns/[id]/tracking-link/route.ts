import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
params: Promise<{ id: string }>;
};

function generateTrackingCode() {
return randomBytes(8).toString("hex");
}

export async function POST(
_request: Request,
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

const fullUser = await prisma.user.findUnique({
  where: {
    id: user.id,
  },
  select: {
    role: true,
    creatorProfile: {
      select: {
        id: true,
      },
    },
  },
});

if (!fullUser) {
  return NextResponse.json(
    { error: "کاربر پیدا نشد." },
    { status: 404 },
  );
}

if (fullUser.role !== "CREATOR") {
  return NextResponse.json(
    { error: "فقط Creator می‌تواند Tracking Link بسازد." },
    { status: 403 },
  );
}

if (!fullUser.creatorProfile) {
  return NextResponse.json(
    { error: "پروفایل Creator کامل نشده است." },
    { status: 400 },
  );
}

const { id: campaignId } = await context.params;

const application =
  await prisma.campaignApplication.findUnique({
    where: {
      campaignId_creatorId: {
        campaignId,
        creatorId: fullUser.creatorProfile.id,
      },
    },
    select: {
      id: true,
      status: true,
      campaign: {
        select: {
          id: true,
          status: true,
          endAt: true,
        },
      },
    },
  });

if (!application) {
  return NextResponse.json(
    { error: "برای این کمپین درخواست همکاری پیدا نشد." },
    { status: 404 },
  );
}

if (application.status !== "APPROVED") {
  return NextResponse.json(
    { error: "درخواست شما هنوز تأیید نشده است." },
    { status: 403 },
  );
}

if (application.campaign.status !== "ACTIVE") {
  return NextResponse.json(
    { error: "این کمپین فعال نیست." },
    { status: 400 },
  );
}

const existingLink =
  await prisma.trackingLink.findUnique({
    where: {
      campaignId_creatorId: {
        campaignId,
        creatorId: fullUser.creatorProfile.id,
      },
    },
  });

if (existingLink) {
  return NextResponse.json({
    ok: true,
    existing: true,
    trackingLink: existingLink,
  });
}

const code = generateTrackingCode();

const trackingLink = await prisma.trackingLink.create({
  data: {
    campaignId,
    creatorId: fullUser.creatorProfile.id,
    code,
    expiresAt: application.campaign.endAt,
  },
});

return NextResponse.json(
  {
    ok: true,
    existing: false,
    trackingLink,
  },
  { status: 201 },
);

} catch (error) {
console.error("Create tracking link error:", error);


return NextResponse.json(
  { error: "ساخت Tracking Link با خطا مواجه شد." },
  { status: 500 },
);


}
}
