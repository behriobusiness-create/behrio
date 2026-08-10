import { prisma } from "../lib/prisma";
import {
  generateApiKey,
  hashApiKey,
  keyPrefixOf,
  generateClickId,
} from "../lib/integrations/keys";

const BASE = "http://localhost:3000";

function check(desc: string, actual: number, expected: number, extra?: unknown) {
  const ok = actual === expected;
  console.log(
    `${ok ? "✅" : "❌"} ${desc} -> ${actual} (expected ${expected})${
      extra !== undefined ? ` | ${JSON.stringify(extra)}` : ""
    }`,
  );
  return ok;
}

async function main() {
  let allOk = true;

  // Fixtures: primary business owns campaign + integration + key
  const businessUser = await prisma.user.create({
    data: { role: "BUSINESS", status: "ACTIVE", email: `biz-${Date.now()}@t.local` },
  });
  const businessProfile = await prisma.businessProfile.create({
    data: { userId: businessUser.id, companyName: "TestBizCo" },
  });
  const creatorUser = await prisma.user.create({
    data: { role: "CREATOR", status: "ACTIVE", email: `c-${Date.now()}@t.local` },
  });
  const creatorProfile = await prisma.creatorProfile.create({
    data: { userId: creatorUser.id, displayName: "Creator" },
  });

  const campaign = await prisma.campaign.create({
    data: {
      businessId: businessProfile.id,
      name: "CPA Campaign",
      type: "CPA",
      accessType: "OPEN",
      status: "ACTIVE",
      budget: 1_000_000,
      rewardPerConversion: 1000,
      destinationUrl: "https://example.com/order",
    },
  });

  const trackingLink = await prisma.trackingLink.create({
    data: {
      campaignId: campaign.id,
      creatorId: creatorProfile.id,
      code: `t-${Date.now()}`,
      status: "ACTIVE",
    },
  });

  const realClickId = generateClickId(false);
  const secondClickId = generateClickId(false);
  await prisma.click.create({ data: { clickId: realClickId, trackingLinkId: trackingLink.id } });
  await prisma.click.create({ data: { clickId: secondClickId, trackingLinkId: trackingLink.id } });

  const secret = generateApiKey();
  await prisma.businessApiKey.create({
    data: {
      userId: businessUser.id,
      name: "Test key",
      keyPrefix: keyPrefixOf(secret),
      keyHash: hashApiKey(secret),
    },
  });

  const integration = await prisma.campaignIntegration.create({
    data: {
      campaignId: campaign.id,
      userId: businessUser.id,
      status: "VERIFIED",
    },
  });

  // A second, different business that owns its own click (for ownership test)
  const otherBusinessUser = await prisma.user.create({
    data: { role: "BUSINESS", status: "ACTIVE", email: `b2-${Date.now()}@t.local` },
  });
  const otherBizProfile = await prisma.businessProfile.create({
    data: { userId: otherBusinessUser.id, companyName: "OtherBiz" },
  });
  const otherCampaign = await prisma.campaign.create({
    data: {
      businessId: otherBizProfile.id,
      name: "Other CPA",
      type: "CPA",
      accessType: "OPEN",
      status: "ACTIVE",
      budget: 500_000,
      rewardPerConversion: 1000,
      destinationUrl: "https://example.com/o",
    },
  });
  const otherLink = await prisma.trackingLink.create({
    data: {
      campaignId: otherCampaign.id,
      creatorId: creatorProfile.id,
      code: `ot-${Date.now()}`,
      status: "ACTIVE",
    },
  });
  const otherClickId = generateClickId(false);
  await prisma.click.create({ data: { clickId: otherClickId, trackingLinkId: otherLink.id } });
  await prisma.campaignIntegration.create({
    data: {
      campaignId: otherCampaign.id,
      userId: otherBusinessUser.id,
      status: "VERIFIED",
    },
  });

  // Suspended user key
  const suspendedUser = await prisma.user.create({
    data: { role: "BUSINESS", status: "SUSPENDED", email: `susp-${Date.now()}@t.local` },
  });
  const suspendedSecret = generateApiKey();
  await prisma.businessApiKey.create({
    data: {
      userId: suspendedUser.id,
      name: "Suspended key",
      keyPrefix: keyPrefixOf(suspendedSecret),
      keyHash: hashApiKey(suspendedSecret),
    },
  });
  const revokedSecret = generateApiKey();
  await prisma.businessApiKey.create({
    data: {
      userId: businessUser.id,
      name: "Revoked key",
      keyPrefix: keyPrefixOf(revokedSecret),
      keyHash: hashApiKey(revokedSecret),
      revokedAt: new Date(),
    },
  });

  const post = (body: unknown, bearer: string) =>
    fetch(`${BASE}/api/v1/integrations/conversions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(body),
    });

  const goodBody = () => ({ clickId: realClickId, orderId: "ORDER-1001", amount: 1000, currency: "IRR", status: "PAID" });

  // 1. No API key -> 401
  const r1 = await fetch(`${BASE}/api/v1/integrations/conversions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goodBody()),
  });
  allOk = check("no api key -> 401", r1.status, 401) && allOk;

  // 2. Invalid API key -> 401
  allOk = check("invalid api key -> 401", (await post(goodBody(), "br_live_invalid")).status, 401) && allOk;

  // 3. Revoked API key -> 401
  allOk = check("revoked api key -> 401", (await post(goodBody(), revokedSecret)).status, 401) && allOk;

  // 4. Suspended user -> 403
  allOk = check("suspended user -> 403", (await post(goodBody(), suspendedSecret)).status, 403) && allOk;

  // 5. Invalid JSON -> 400
  const r5 = await fetch(`${BASE}/api/v1/integrations/conversions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: "{not-json",
  });
  allOk = check("invalid json -> 400", r5.status, 400) && allOk;

  // 6. Missing clickId -> 400
  allOk = check("missing clickId -> 400", (await post({ orderId: "ORDER-1001", amount: 1000, currency: "IRR", status: "PAID" }, secret)).status, 400) && allOk;

  // 7. Missing orderId -> 400
  allOk = check("missing orderId -> 400", (await post({ clickId: realClickId, amount: 1000, currency: "IRR", status: "PAID" }, secret)).status, 400) && allOk;

  // 8. Invalid currency -> 400
  allOk = check("invalid currency -> 400", (await post({ ...goodBody(), currency: "USD" }, secret)).status, 400) && allOk;

  // 9. Invalid amount -> 400
  allOk = check("invalid amount -> 400", (await post({ ...goodBody(), amount: "-5" }, secret)).status, 400) && allOk;

  // 10. Unknown clickId -> 404
  allOk = check("unknown clickId -> 404", (await post({ ...goodBody(), clickId: "no_such_click" }, secret)).status, 404) && allOk;

  // 11. Click from other business campaign -> 403 (ownership)
  allOk = check("click from other business -> 403", (await post({ ...goodBody(), clickId: otherClickId }, secret)).status, 403) && allOk;

  // 12. Integration DISABLED -> 403
  await prisma.campaignIntegration.update({ where: { id: integration.id }, data: { status: "DISABLED" } });
  allOk = check("disabled integration -> 403", (await post(goodBody(), secret)).status, 403) && allOk;
  await prisma.campaignIntegration.update({ where: { id: integration.id }, data: { status: "VERIFIED" } });

  // 13. Integration NOT VERIFIED -> 403
  await prisma.campaignIntegration.update({ where: { id: integration.id }, data: { status: "CONFIGURED" } });
  allOk = check("not verified integration -> 403", (await post(goodBody(), secret)).status, 403) && allOk;
  await prisma.campaignIntegration.update({ where: { id: integration.id }, data: { status: "VERIFIED" } });

  // 14. Campaign not ACTIVE -> 409
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
  allOk = check("campaign not active -> 409", (await post(goodBody(), secret)).status, 409) && allOk;
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });

  // 15. Tracking link not ACTIVE -> 409
  await prisma.trackingLink.update({ where: { id: trackingLink.id }, data: { status: "PAUSED" } });
  allOk = check("tracking link not active -> 409", (await post(goodBody(), secret)).status, 409) && allOk;
  await prisma.trackingLink.update({ where: { id: trackingLink.id }, data: { status: "ACTIVE" } });

  // 16. Expired tracking link -> 409
  await prisma.trackingLink.update({ where: { id: trackingLink.id }, data: { expiresAt: new Date("2020-01-01") } });
  allOk = check("expired tracking link -> 409", (await post(goodBody(), secret)).status, 409) && allOk;
  await prisma.trackingLink.update({ where: { id: trackingLink.id }, data: { expiresAt: null } });

  // 17. Invalid status -> 400
  allOk = check("invalid status -> 400", (await post({ ...goodBody(), status: "BOGUS" }, secret)).status, 400) && allOk;

  // 18. Successful conversion -> 201, source INTEGRATION, status PENDING
  const r18 = await post(goodBody(), secret);
  const b18 = await r18.json();
  allOk = check("successful conversion -> 201", r18.status, 201, b18) && allOk;
  const conv = await prisma.conversion.findFirst({ where: { clickId: realClickId } });
  if (conv && conv.source === "INTEGRATION" && conv.status === "PENDING") {
    console.log(`  conversion: source=${conv.source}, status=${conv.status}`);
  } else {
    console.log(`  conversion expected INTEGRATION/PENDING got ${conv?.source}/${conv?.status}`);
    allOk = false;
  }

  // 19. Duplicate externalOrderId -> 409
  allOk = check("duplicate externalOrderId -> 409", (await post({ ...goodBody(), clickId: secondClickId }, secret)).status, 409) && allOk;

  // 20. Same click already converted -> 409
  allOk = check("click already converted -> 409", (await post({ ...goodBody(), orderId: "ORDER-2002" }, secret)).status, 409) && allOk;

  // 21. Test conversion requires TEST- order prefix -> 400
  const testId = generateClickId(true);
  await prisma.campaignIntegration.update({
    where: { id: integration.id },
    data: { testClickId: testId, status: "CONFIGURED" },
  });
  allOk = check(
    "test conversion with non TEST- order -> 400",
    (await post({ clickId: testId, orderId: "REAL-123", amount: 500, currency: "IRR", status: "TEST" }, secret)).status,
    400,
  ) && allOk;

  // 22. Valid test conversion -> 200, integration VERIFIED, no real conversion
  const r22 = await post({ clickId: testId, orderId: "TEST-4422", amount: 500, currency: "IRR", status: "TEST" }, secret);
  const b22 = await r22.json();
  allOk = check("test conversion -> 200", r22.status, 200, b22) && allOk;
  const after = await prisma.campaignIntegration.findUnique({ where: { id: integration.id } });
  const verifiedOk = after?.status === "VERIFIED";
  console.log(`${verifiedOk ? "✅" : "❌"} integration marked VERIFIED after test -> ${after?.status}`);
  allOk = verifiedOk && allOk;
  const realConvCount = await prisma.conversion.count({ where: { clickId: testId } });
  const noRealConv = realConvCount === 0;
  console.log(`${noRealConv ? "✅" : "❌"} test conversion created no real conversion -> ${realConvCount}`);
  allOk = noRealConv && allOk;

  // 23. API request log written
  const log = await prisma.apiRequestLog.findFirst({ orderBy: { createdAt: "desc" } });
  const logOk = !!log && log.endpoint === "/api/v1/integrations/conversions";
  console.log(`${logOk ? "✅" : "❌"} api request log written -> ${log?.endpoint}`);
  allOk = logOk && allOk;

  // 24. X-Behrio-Request-Id header present
  const rid = r22.headers.get("X-Behrio-Request-Id");
  console.log(`${rid ? "✅" : "❌"} X-Behrio-Request-Id present -> ${rid ?? "none"}`);
  allOk = (!!rid) && allOk;

  // Cleanup
  await prisma.apiRequestLog.deleteMany({ where: { userId: businessUser.id } });
  await prisma.conversion.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.click.deleteMany({ where: { trackingLinkId: trackingLink.id } });
  await prisma.trackingLink.deleteMany({ where: { id: trackingLink.id } });
  await prisma.click.deleteMany({ where: { trackingLinkId: otherLink.id } });
  await prisma.trackingLink.deleteMany({ where: { id: otherLink.id } });
  await prisma.campaignIntegration.deleteMany({ where: { campaignId: { in: [campaign.id, otherCampaign.id] } } });
  await prisma.campaign.deleteMany({ where: { id: { in: [campaign.id, otherCampaign.id] } } });
  await prisma.businessApiKey.deleteMany({ where: { userId: { in: [businessUser.id, suspendedUser.id] } } });
  await prisma.creatorProfile.deleteMany({ where: { userId: creatorUser.id } });
  await prisma.businessProfile.deleteMany({ where: { userId: { in: [businessUser.id, otherBusinessUser.id] } } });
  await prisma.user.deleteMany({
    where: { id: { in: [businessUser.id, creatorUser.id, otherBusinessUser.id, suspendedUser.id] } },
  });

  console.log(allOk ? "\nALL TESTS PASSED ✅" : "\nSOME TESTS FAILED ❌");
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());