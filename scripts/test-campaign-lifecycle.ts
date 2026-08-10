import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";

const BASE = "http://localhost:3000";

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

async function patchStatus(
  token: string,
  campaignId: string,
  status: string,
) {
  const res = await fetch(`${BASE}/api/campaigns/${campaignId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": token,
    },
    body: JSON.stringify({ status }),
  });
  return { status: res.status, body: await res.json() };
}

function check(desc: string, actual: number, expected: number) {
  const ok = actual === expected;
  console.log(`${ok ? "✅" : "❌"} ${desc} -> ${actual} (expected ${expected})`);
  return ok;
}

async function main() {
  let allOk = true;

  const draftOwner = "cmsk535kz000h6416sfcuqnqz";
  const mainOwner = "cmsd850eo0000df16gsrodvwz";
  const otherUser = "cmsfseiad0000ve167ov4v0lh";

  const draftCampaign = "cmsk55u3g000k6416jp2enues"; // DRAFT, owner=draftOwner
  const exhaustedCampaign = "cmsk82fav000yt116e9hxbl18"; // PAUSED, spent=budget
  const activeCampaign = "cmsk7zjsy0000g016vyxx98ma"; // ACTIVE, spent=0

  const draftToken = await createSessionToken(draftOwner);
  const ownerToken = await createSessionToken(mainOwner);
  const otherToken = await createSessionToken(otherUser);

  // Seed verified integrations (business rule: campaign cannot be submitted
  // for review or activated until the Conversion API integration is VERIFIED).
  async function ensureIntegration(campaignId: string, userId: string) {
    const integration = await prisma.campaignIntegration.findUnique({
      where: { campaignId },
    });
    if (!integration) {
      await prisma.campaignIntegration.create({
        data: { campaignId, userId, status: "VERIFIED" },
      });
    } else if (integration.status !== "VERIFIED") {
      await prisma.campaignIntegration.update({
        where: { id: integration.id },
        data: { status: "VERIFIED", verifiedAt: new Date() },
      });
    }
  }
  await ensureIntegration(draftCampaign, draftOwner);
  await ensureIntegration(activeCampaign, mainOwner);

  // 1. Unauthenticated -> 401
  const noAuth = await fetch(`${BASE}/api/campaigns/${draftCampaign}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PENDING_REVIEW" }),
  });
  allOk = check("unauthenticated -> 401", noAuth.status, 401) && allOk;

  // 2. Non-owner -> 403
  const nonOwner = await patchStatus(otherToken, draftCampaign, "PENDING_REVIEW");
  allOk = check("non-owner -> 403", nonOwner.status, 403) && allOk;

  // 3. DRAFT -> PENDING_REVIEW (owner) -> 200
  const submit = await patchStatus(draftToken, draftCampaign, "PENDING_REVIEW");
  allOk = check("DRAFT -> PENDING_REVIEW -> 200", submit.status, 200) && allOk;

  // 4. Business cannot skip admin review: PENDING_REVIEW -> ACTIVE -> 400
  const skipAdmin = await patchStatus(draftToken, draftCampaign, "ACTIVE");
  allOk = check("PENDING_REVIEW -> ACTIVE (business) -> 400", skipAdmin.status, 400) && allOk;

  // 5. Invalid transition: PENDING_REVIEW -> PAUSED -> 400
  const invalid = await patchStatus(draftToken, draftCampaign, "PAUSED");
  allOk = check("PENDING_REVIEW -> PAUSED -> 400", invalid.status, 400) && allOk;

  // 6. Activate exhausted PAUSED campaign -> 400 (budget spent)
  const exhausted = await patchStatus(ownerToken, exhaustedCampaign, "ACTIVE");
  allOk = check("PAUSED -> ACTIVE (budget spent) -> 400", exhausted.status, 400) && allOk;
  if (exhausted.status === 400) {
    console.log("   error message:", exhausted.body.error);
  }

  // 7. ACTIVE -> PAUSED (owner) -> 200
  const pause = await patchStatus(ownerToken, activeCampaign, "PAUSED");
  allOk = check("ACTIVE -> PAUSED -> 200", pause.status, 200) && allOk;

  // 8. PAUSED -> ACTIVE (owner, budget available) -> 200
  const resume = await patchStatus(ownerToken, activeCampaign, "ACTIVE");
  allOk = check("PAUSED -> ACTIVE -> 200", resume.status, 200) && allOk;

  // restore exhausted campaign state (leave it PAUSED as it was)
  console.log(allOk ? "\nALL TESTS PASSED ✅" : "\nSOME TESTS FAILED ❌");
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
