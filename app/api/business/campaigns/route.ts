import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma, CampaignType, CampaignAccessType } from "@/app/generated/prisma/client";
import { getBusinessWallet } from "@/lib/wallet";

const VALID_TYPES = new Set<string>(Object.values(CampaignType));
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
      rewardPerClick,
      rewardPerConversion,
      rewardPerThousand,
      commissionPercent,
      clickRewardPerGroup,
      conversionGoal,
      destinationUrl,
      accessType,
    } = body;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "نام کمپین الزامی است." }, { status: 400 });
    }

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "نوع کمپین نامعتبر است." }, { status: 400 });
    }

    const access = accessType && VALID_ACCESS_TYPES.has(accessType) ? accessType : "OPEN";

    if (
      budget === undefined ||
      budget === null ||
      Number.isNaN(Number(budget)) ||
      Number(budget) <= 0
    ) {
      return NextResponse.json({ error: "بودجه کمپین باید بیشتر از صفر باشد." }, { status: 400 });
    }

    if (typeof destinationUrl !== "string" || !isValidDestinationUrl(destinationUrl.trim())) {
      return NextResponse.json(
        { error: "آدرس مقصد نامعتبر است. فقط http/https مجاز است." },
        { status: 400 }
      );
    }

    const rewardClick =
      rewardPerClick === undefined || rewardPerClick === null
        ? null
        : Number(rewardPerClick);

    const rewardConversion =
      rewardPerConversion === undefined || rewardPerConversion === null
        ? null
        : Number(rewardPerConversion);

    const rewardThousand =
      rewardPerThousand === undefined || rewardPerThousand === null
        ? null
        : Number(rewardPerThousand);

    const percent =
      commissionPercent === undefined || commissionPercent === null
        ? null
        : Number(commissionPercent);

    const groupSize =
      clickRewardPerGroup === undefined || clickRewardPerGroup === null
        ? 1
        : Number(clickRewardPerGroup);

    if ((rewardClick !== null && (!Number.isFinite(rewardClick) || rewardClick < 0)) ||
        (rewardConversion !== null && (!Number.isFinite(rewardConversion) || rewardConversion < 0)) ||
        (rewardThousand !== null && (!Number.isFinite(rewardThousand) || rewardThousand < 0))) {
      return NextResponse.json(
        { error: "پاداش کمپین نامعتبر است." },
        { status: 400 }
      );
    }

    if (percent !== null && (!Number.isFinite(percent) || percent <= 0 || percent > 100)) {
      return NextResponse.json(
        { error: "درصد کمیسیون باید بین ۰ تا ۱۰۰ باشد." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(groupSize) || groupSize < 1) {
      return NextResponse.json(
        { error: "تعداد کلیک در هر گروه باید عدد صحیح بزرگ‌تر از صفر باشد." },
        { status: 400 }
      );
    }

    let conversionGoalValue: number | null = null;
    if (conversionGoal !== undefined && conversionGoal !== null && conversionGoal !== "") {
      conversionGoalValue = Number(conversionGoal);
      if (!Number.isInteger(conversionGoalValue) || conversionGoalValue < 1) {
        return NextResponse.json(
          { error: "هدف تعداد تبدیل باید عدد صحیح بزرگ‌تر از صفر باشد." },
          { status: 400 }
        );
      }
    }

    const isClickBased = type === "CPC" || type === "CPA";

    if (isClickBased && (rewardClick === null || rewardClick <= 0)) {
      return NextResponse.json(
        { error: "برای کمپین کلیک‌محور (CPC/CPA)، مبلغ پاداش به‌ازای گروه کلیک الزامی است." },
        { status: 400 }
      );
    }

    if (type === "CPM" || type === "CLIPPING") {
      if (rewardThousand === null || rewardThousand <= 0) {
        return NextResponse.json(
          { error: "برای کمپین نمایشی (CPM/کلیپینگ)، پاداش به‌ازای هر ۱۰۰۰ نمایش الزامی است." },
          { status: 400 }
        );
      }
    }

    if (type === "AFFILIATE" && percent === null) {
      return NextResponse.json(
        { error: "برای کمپین وابسته (Affiliate)، درصد کمیسیون الزامی است." },
        { status: 400 }
      );
    }

    const businessProfileId = fullUser.businessProfile.id;

    const campaign = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE
      `;
      if (rows.length === 0) return null;

      const wallet = await getBusinessWallet(tx, user.id);

      if (new Prisma.Decimal(String(budget)).gt(wallet.available)) {
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
          type: type as CampaignType,
          accessType: access as CampaignAccessType,
          budget: Number(budget),
          reservedAmount: Number(budget),
          rewardPerClick: rewardClick,
          rewardPerConversion: rewardConversion,
          rewardPerThousand: rewardThousand,
          commissionPercent: percent,
          clickRewardPerGroup: groupSize,
          conversionGoal: conversionGoalValue,
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
