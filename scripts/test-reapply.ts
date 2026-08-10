import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";

const BASE = "http://localhost:3000";
const CAMPAIGN_ID = "cmsk7zjsy0000g016vyxx98ma"; // ACTIVE OPEN, remaining budget
const CREATOR_USER_ID = "cmsk45lce0002lg167wlh9x1e";

async function createSessionToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

async function main() {
  let allOk = true;

  const creator = await prisma.creatorProfile.findUnique({
    where: { userId: CREATOR_USER_ID },
  });
  if (!creator) {
    console.error("creator not found");
    process.exit(1);
  }

  const existing = await prisma.campaignApplication.findUnique({
    where: {
      campaignId_creatorId: { campaignId: CAMPAIGN_ID, creatorId: creator.id },
    },
  });
  if (existing) {
    console.error("precondition failed: application already exists");
    await prisma.$disconnect();
    process.exit(1);
  }

  const token = await createSessionToken(CREATOR_USER_ID);

  const apply = () =>
    fetch(`${BASE}/api/creator/campaigns/${CAMPAIGN_ID}/apply`, {
      method: "POST",
      headers: { "x-session-token": token },
    });

  // 1. First apply (OPEN -> APPROVED)
  const r1 = await apply();
  const b1 = await r1.json();
  const ok1 = r1.status === 201 && b1.application?.status === "APPROVED";
  console.log(`${ok1 ? "✅" : "❌"} first apply -> ${r1.status}, status=${b1.application?.status}`);
  allOk = ok1 && allOk;

  const linksAfterFirst = await prisma.trackingLink.count({
    where: { campaignId: CAMPAIGN_ID, creatorId: creator.id },
  });
  console.log(`  tracking links after first apply: ${linksAfterFirst}`);
  allOk = linksAfterFirst === 1 && allOk;

  // 2. Simulate rejection by business
  await prisma.campaignApplication.update({
    where: {
      campaignId_creatorId: { campaignId: CAMPAIGN_ID, creatorId: creator.id },
    },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });

  // 3. Reapply after REJECTED -> should succeed
  const r2 = await apply();
  const b2 = await r2.json();
  const ok2 = r2.status === 201 && b2.application?.status === "APPROVED";
  console.log(`${ok2 ? "✅" : "❌"} reapply after REJECTED -> ${r2.status}, status=${b2.application?.status}`);
  allOk = ok2 && allOk;

  const linksAfterReapply = await prisma.trackingLink.count({
    where: { campaignId: CAMPAIGN_ID, creatorId: creator.id },
  });
  console.log(`  tracking links after reapply: ${linksAfterReapply}`);
  allOk = linksAfterReapply === 1 && allOk;

  // 4. Reapply while APPROVED -> 409
  const r3 = await apply();
  const ok3 = r3.status === 409;
  console.log(`${ok3 ? "✅" : "❌"} reapply while APPROVED -> ${r3.status} (expected 409)`);
  allOk = ok3 && allOk;

  // 5. Cleanup
  await prisma.trackingLink.deleteMany({
    where: { campaignId: CAMPAIGN_ID, creatorId: creator.id },
  });
  await prisma.campaignApplication.deleteMany({
    where: { campaignId: CAMPAIGN_ID, creatorId: creator.id },
  });
  await prisma.authSession.deleteMany({ where: { userId: CREATOR_USER_ID, expiresAt: { gt: new Date() } } });
  console.log("cleanup done");

  console.log(allOk ? "\nALL TESTS PASSED ✅" : "\nSOME TESTS FAILED ❌");
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
