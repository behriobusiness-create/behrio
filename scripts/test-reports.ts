import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { Prisma } from "../app/generated/prisma/client";

const BASE = "http://localhost:3000";

async function makeUser(role: "CREATOR" | "BUSINESS", tag: string) {
  const email = `test-${tag}-${Date.now()}@behrio.test`;
  const user = await prisma.user.create({
    data: { email, role },
  });

  if (role === "CREATOR") {
    await prisma.creatorProfile.create({
      data: {
        userId: user.id,
        displayName: `تستر خالق ${tag}`,
      },
    });
  } else {
    await prisma.businessProfile.create({
      data: {
        userId: user.id,
        companyName: `تستر کسب‌وکار ${tag}`,
      },
    });
  }

  const token = randomBytes(32).toString("hex");
  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return { user, token };
}

async function main() {
  const business = await makeUser("BUSINESS", "reports");
  const creator = await makeUser("CREATOR", "reports");

  const campaign = await prisma.campaign.create({
    data: {
      businessId: (
        await prisma.businessProfile.findUniqueOrThrow({
          where: { userId: business.user.id },
        })
      ).id,
      name: "کمپین تست نمایش CPM",
      type: "CPM",
      accessType: "OPEN",
      status: "ACTIVE",
      destinationUrl: "https://example.com",
      budget: new Prisma.Decimal(3_000_000),
      reservedAmount: new Prisma.Decimal(3_000_000),
      rewardPerThousand: new Prisma.Decimal(200_000),
    },
  });

  const creatorProfile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: creator.user.id },
  });

  await prisma.trackingLink.create({
    data: {
      campaignId: campaign.id,
      creatorId: creatorProfile.id,
      code: `report-${Date.now()}`,
      status: "ACTIVE",
    },
  });

  const headers = { "Content-Type": "application/json" };
  const creatorHeaders = { ...headers, "x-session-token": creator.token };
  const businessHeaders = { ...headers, "x-session-token": business.token };

  // 1) Creator submits a report for 5,000 impressions
  const reportRes = await fetch(`${BASE}/api/campaign-reports`, {
    method: "POST",
    headers: creatorHeaders,
    body: JSON.stringify({ campaignId: campaign.id, claimedImpressions: 5000 }),
  });
  const reportBody = await reportRes.json();
  console.log("create report:", reportRes.status, reportBody);

  if (!reportRes.ok) throw new Error("report creation failed");

  const reportId = reportBody.report.id;

  // 2) Business approves → 5 groups × 200,000 = 1,000,000
  const approveRes = await fetch(`${BASE}/api/campaign-reports/${reportId}/approve`, {
    method: "POST",
    headers: businessHeaders,
  });
  const approveBody = await approveRes.json();
  console.log("approve report:", approveRes.status, approveBody);

  if (!approveRes.ok) throw new Error("approve failed");

  const ledger = await prisma.ledgerEntry.findMany({
    where: { userId: creator.user.id, type: "CREATOR_EARNING", status: "AVAILABLE" },
  });
  const campaignAfter = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
  });
  const reportAfter = await prisma.campaignReport.findUniqueOrThrow({
    where: { id: reportId },
  });

  const ledgerTotal = ledger.reduce((s, l) => s + Number(l.amount), 0);
  console.log("ledger entries:", ledger.length, "total:", ledgerTotal);
  console.log("campaign spent:", Number(campaignAfter.spentAmount));
  console.log("report status:", reportAfter.status);

  const pass =
    ledger.length === 5 &&
    ledgerTotal === 1_000_000 &&
    Number(campaignAfter.spentAmount) === 1_000_000 &&
    reportAfter.status === "APPROVED";

  console.log(pass ? "\nTEST PASSED ✅" : "\nTEST FAILED ❌");
  process.exit(pass ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
