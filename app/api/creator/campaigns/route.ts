import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
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
    { error: "فقط تولیدکنندگان محتوا می‌توانند کمپین‌ها را ببینند." },
    { status: 403 },
  );
}

if (!fullUser.creatorProfile) {
  return NextResponse.json(
    { error: "پروفایل تولیدکننده محتوا کامل نشده است." },
    { status: 400 },
  );
}

const campaigns = await prisma.campaign.findMany({
  where: {
    status: "ACTIVE",
    type: "CPM",
    OR: [
      {
        accessType: "OPEN",
      },
      {
        accessType: "HYBRID",
      },
      {
        accessType: "APPROVAL_REQUIRED",
      },
    ],
  },
  select: {
    id: true,
    name: true,
    description: true,
    type: true,
    accessType: true,
    budget: true,
    currency: true,
    cpm: true,
    verifiedImpressions: true,
    startAt: true,
    endAt: true,
    createdAt: true,
    business: {
      select: {
        companyName: true,
        website: true,
      },
    },
  },
  orderBy: {
    createdAt: "desc",
  },
});

return NextResponse.json({
  ok: true,
  campaigns,
});


} catch (error) {
console.error("Creator campaign discovery error:", error);


return NextResponse.json(
  { error: "دریافت کمپین‌ها با خطا مواجه شد." },
  { status: 500 },
);


}
}
