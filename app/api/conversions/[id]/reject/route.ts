import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const actor = await getCurrentUser();

    if (!actor) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const conversion = await prisma.conversion.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        campaignId: true,
        campaign: { select: { businessId: true } },
      },
    });

    if (!conversion) {
      return NextResponse.json(
        { error: "Conversion پیدا نشد." },
        { status: 404 }
      );
    }

    const isAdmin = actor.role === "ADMIN";
    const isCampaignOwner = conversion.campaign.businessId
      ? await prisma.businessProfile.findFirst({
          where: {
            id: conversion.campaign.businessId,
            userId: actor.id,
          },
        })
      : null;

    if (!isAdmin && !isCampaignOwner) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز." },
        { status: 403 }
      );
    }

    if (conversion.status !== "PENDING") {
      return NextResponse.json(
        { error: "این تبدیل قبلاً بررسی شده است." },
        { status: 400 }
      );
    }

    const updated = await prisma.conversion.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ ok: true, conversion: updated });
  } catch (error) {
    console.error("Reject conversion error:", error);

    return NextResponse.json(
      { error: "رد تبدیل با خطا مواجه شد." },
      { status: 500 }
    );
  }
}
