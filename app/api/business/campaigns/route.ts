import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma, CampaignAccessType } from "@/app/generated/prisma/client";
import { getBusinessWallet } from "@/lib/wallet";
import { parseCpm, parsePositiveBudget } from "@/lib/finance/cpm";

const VALID_ACCESS_TYPES = new Set<string>(Object.values(CampaignAccessType));

function isValidDestinationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { businessProfile: true },
    });

    if (!fullUser || fullUser.role !== "BUSINESS" || !fullUser.businessProfile) {
      return NextResponse.json(
        { error: "دسترسی فقط برای Business است." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      name,
      description,
      type,
      budget,
      cpm,
      destinationUrl,
      accessType,
    } = body;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "نام کمپین الزامی است." }, { status: 400 });
    }

    // Behrio supports CPM exclusively. Reject any other pricing model.
    if (type !== undefined && type !== null && type !== "CPM") {
      return NextResponse.json(
        { error: "فقط مدل قیمت‌گذاری CPM پشتیبانی می‌شود." },
        { status: 400 }
      );
    }

    const access = accessType && VALID_ACCESS_TYPES.has(accessType) ? accessType : "OPEN";

    const budgetCheck = parsePositiveBudget(budget);
    if (!budgetCheck.ok) {
      return NextResponse.json({ error: budgetCheck.error }, { status: 400 });
    }

    const cpmCheck = parseCpm(cpm);
    if (!cpmCheck.ok || !cpmCheck.value) {
      return NextResponse.json({ error: cpmCheck.error }, { status: 400 });
    }

    if (typeof destinationUrl !== "string" || !isValidDestinationUrl(destinationUrl.trim())) {
      return NextResponse.json(
        { error: "آدرس مقصد نامعتبر است. فقط http/https مجاز است." },
        { status: 400 }
      );
    }

    const budgetValue = budgetCheck.value!;
    const cpmValue = cpmCheck.value!;

    const businessProfileId = fullUser.businessProfile.id;

    const campaign = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE
      `;
      if (rows.length === 0) return null;

      const wallet = await getBusinessWallet(tx, user.id);

      if (budgetValue.gt(wallet.available)) {
        return {
          error: "INSUFFICIENT_BALANCE",
          wallet: {
            available: wallet.available.toNumber(),
            funded: wallet.funded.toNumber(),
          },
        };
      }

      return tx.campaign.create({
        data: {
          businessId: businessProfileId,
          name: name.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          type: "CPM",
          accessType: access as CampaignAccessType,
          budget: budgetValue,
          reservedAmount: budgetValue,
          cpm: cpmValue,
          verifiedImpressions: 0,
          destinationUrl: destinationUrl.trim(),
          status: "DRAFT",
          currency: "IRR",
        },
      });
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "کاربر پیدا نشد." },
        { status: 404 }
      );
    }

    if ("error" in campaign && campaign.error === "INSUFFICIENT_BALANCE") {
      const wallet = campaign.wallet as { available: number; funded: number };
      return NextResponse.json(
        {
          error: "موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید.",
          wallet,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json({ error: "خطا در ساخت کمپین." }, { status: 500 });
  }
}
