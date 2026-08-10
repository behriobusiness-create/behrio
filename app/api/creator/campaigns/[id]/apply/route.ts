import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  campaignHasCapacity,
  lockCampaignForCapacityCheck,
} from "@/lib/campaign/capacity";

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
    { error: "فقط تولیدکنندگان محتوا می‌توانند درخواست همکاری ارسال کنند." },
    { status: 403 },
  );
}

if (!fullUser.creatorProfile) {
  return NextResponse.json(
    { error: "پروفایل تولیدکننده محتوا کامل نشده است." },
    { status: 400 },
  );
}

const { id: campaignId } = await context.params;

const creatorProfile = fullUser.creatorProfile;

const result = await prisma.$transaction(async (tx) => {
  const campaign = await lockCampaignForCapacityCheck(tx, campaignId);

  if (!campaign) {
    return { kind: "NOT_FOUND" as const };
  }

  const capacity = campaignHasCapacity(campaign);

  if (!capacity.ok) {
    return { kind: "CAPACITY" as const, reason: capacity.reason };
  }

  const now = new Date();

  if (campaign.startAt && campaign.startAt > now) {
    return { kind: "NOT_STARTED" as const };
  }

  const accessType = campaign.accessType;

  const existingApplication =
    await tx.campaignApplication.findUnique({
      where: {
        campaignId_creatorId: {
          campaignId: campaign.id,
          creatorId: creatorProfile.id,
        },
      },
    });

  const isOpen = accessType === "OPEN";

  if (existingApplication) {
    if (existingApplication.status !== "REJECTED") {
      return {
        kind: "DUPLICATE" as const,
        application: existingApplication,
      };
    }

    const application = await tx.campaignApplication.update({
      where: {
        campaignId_creatorId: {
          campaignId: campaign.id,
          creatorId: creatorProfile.id,
        },
      },
      data: {
        status: isOpen ? "APPROVED" : "PENDING",
        reviewedAt: isOpen ? new Date() : null,
      },
    });

    if (isOpen) {
      await ensureTrackingLink(
        tx,
        campaign.id,
        creatorProfile.id,
        campaign.endAt
      );
    }

    return { kind: "OK" as const, application };
  }

  const application = await tx.campaignApplication.create({
    data: {
      campaignId: campaign.id,
      creatorId: creatorProfile.id,
      status: isOpen ? "APPROVED" : "PENDING",
      reviewedAt: isOpen ? new Date() : null,
    },
  });

  if (isOpen) {
    await ensureTrackingLink(
      tx,
      campaign.id,
      creatorProfile.id,
      campaign.endAt
    );
  }

  return { kind: "OK" as const, application };
});

if (result.kind === "NOT_FOUND") {
  return NextResponse.json(
    { error: "کمپین پیدا نشد." },
    { status: 404 }
  );
}

if (result.kind === "CAPACITY") {
  return NextResponse.json({ error: result.reason }, { status: 400 });
}

if (result.kind === "NOT_STARTED") {
  return NextResponse.json(
    { error: "این کمپین هنوز آغاز نشده است." },
    { status: 400 }
  );
}

if (result.kind === "DUPLICATE") {
  return NextResponse.json(
    {
      error: "شما قبلاً برای این کمپین درخواست ارسال کرده‌اید.",
      application: result.application,
    },
    { status: 409 }
  );
}

return NextResponse.json(
  {
    ok: true,
    application: result.application,
  },
  { status: 201 }
);


} catch (error) {
console.error("Creator campaign application error:", error);


return NextResponse.json(
  { error: "ارسال درخواست همکاری با خطا مواجه شد." },
  { status: 500 },
);


}
}

async function ensureTrackingLink(
  db: Prisma.TransactionClient,
  campaignId: string,
  creatorId: string,
  expiresAt: Date | null,
) {
  const existingLink = await db.trackingLink.findUnique({
    where: {
      campaignId_creatorId: {
        campaignId,
        creatorId,
      },
    },
  });

  if (!existingLink) {
    await db.trackingLink.create({
      data: {
        campaignId,
        creatorId,
        code: generateTrackingCode(),
        expiresAt,
      },
    });
  }
}
