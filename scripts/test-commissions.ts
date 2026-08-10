import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { Prisma } from "../app/generated/prisma/client";
import { getAvailableBalance } from "../lib/wallet";
import {
  BUSINESS_COMMISSION_RATE,
  CREATOR_COMMISSION_RATE,
  CAMPAIGN_FEE_PREFIX,
  WITHDRAWAL_FEE_PREFIX,
  calculateBusinessCommission,
  calculateCreatorCommission,
  calculateCreatorNetAmount,
  calculateWithdrawalSettlement,
} from "../lib/finance/commission";

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

let failures = 0;

function check(desc: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "✅" : "❌"} ${desc} -> ${String(actual)} (expected ${String(expected)})`,
  );
  return ok;
}

function checkGt(desc: string, actual: number, min: number) {
  const ok = actual >= min;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "✅" : "❌"} ${desc} -> ${actual} (expected >= ${min})`,
  );
  return ok;
}

type ApproveResponse = {
  status: number;
  body: {
    autoClosed?: boolean;
    autoCloseReason?: string | null;
    [key: string]: unknown;
  };
};

async function approve(
  token: string,
  conversionId: string,
): Promise<ApproveResponse> {
  const res = await fetch(`${BASE}/api/conversions/${conversionId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify({}),
  });
  const body = (await res.json()) as ApproveResponse["body"];
  return { status: res.status, body };
}

async function patchCampaignStatus(token: string, campaignId: string, status: string) {
  const res = await fetch(`${BASE}/api/campaigns/${campaignId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify({ status }),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const unique = Date.now().toString(36);

  // ---------- Fixtures ----------
  const businessUser = await prisma.user.create({
    data: { role: "BUSINESS", status: "ACTIVE", email: `biz-c-${unique}@t.local` },
  });
  const businessProfile = await prisma.businessProfile.create({
    data: { userId: businessUser.id, companyName: "CommissionBiz" },
  });
  const creatorUser = await prisma.user.create({
    data: { role: "CREATOR", status: "ACTIVE", email: `cr-c-${unique}@t.local` },
  });
  const creatorProfile = await prisma.creatorProfile.create({
    data: { userId: creatorUser.id, displayName: "CommissionCreator" },
  });
  const adminUser = await prisma.user.create({
    data: { role: "ADMIN", status: "ACTIVE", email: `adm-c-${unique}@t.local` },
  });

  const bizToken = await createSessionToken(businessUser.id);
  const creatorToken = await createSessionToken(creatorUser.id);
  const adminToken = await createSessionToken(adminUser.id);

  async function makeActiveCampaign(opts: {
    name: string;
    budget: number;
    reward?: number;
    conversionGoal?: number;
    endAt?: Date | null;
  }) {
    const campaign = await prisma.campaign.create({
      data: {
        businessId: businessProfile.id,
        name: opts.name,
        type: "CPA",
        accessType: "OPEN",
        status: "ACTIVE",
        budget: opts.budget,
        rewardPerConversion: opts.reward ?? 1_000_000,
        conversionGoal: opts.conversionGoal ?? null,
        endAt: opts.endAt ?? null,
        destinationUrl: "https://example.com/x",
      },
    });
    await prisma.campaignIntegration.create({
      data: { campaignId: campaign.id, userId: businessUser.id, status: "VERIFIED" },
    });
    const link = await prisma.trackingLink.create({
      data: {
        campaignId: campaign.id,
        creatorId: creatorProfile.id,
        code: `cl-${unique}-${campaign.id.slice(-4)}`,
        status: "ACTIVE",
      },
    });
    return { campaign, link };
  }

  async function pendingConversion(campaignId: string, linkId: string, amount?: number) {
    return prisma.conversion.create({
      data: {
        trackingLinkId: linkId,
        campaignId,
        amount: amount ?? null,
        status: "PENDING",
      },
    });
  }

  // ---------- Pure calculation tests ----------
  const feeCalc = calculateBusinessCommission(new Prisma.Decimal(100_000_000));
  check("business fee 100M -> 5M", feeCalc.toNumber(), 5_000_000);
  const creatorFee = calculateCreatorCommission(new Prisma.Decimal(10_000_000));
  check("creator fee 10M -> 1.5M", creatorFee.toNumber(), 1_500_000);
  check("creator net 10M -> 8.5M", calculateCreatorNetAmount(new Prisma.Decimal(10_000_000)).toNumber(), 8_500_000);
  check("config rates", [BUSINESS_COMMISSION_RATE.toNumber(), CREATOR_COMMISSION_RATE.toNumber()].join(","), "5,15");

  // ---------- Scenario A: budget exhausted -> auto-close + 5% business fee ----------
  const A = await makeActiveCampaign({ name: "A budget exhaust", budget: 100_000_000, reward: 100_000_000 });
  const convA = await pendingConversion(A.campaign.id, A.link.id, 100_000_000);
  const resA = await approve(bizToken, convA.id);
  check("A approve -> 200", resA.status, 200);
  check("A autoClosed (BUDGET_EXHAUSTED)", resA.body.autoCloseReason, "BUDGET_EXHAUSTED");
  const campaignA = await prisma.campaign.findUniqueOrThrow({ where: { id: A.campaign.id } });
  check("A status COMPLETED", campaignA.status, "COMPLETED");
  check("A reservedAmount == spentAmount", Number(campaignA.reservedAmount), Number(campaignA.spentAmount));
  const feeA = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceId: `${CAMPAIGN_FEE_PREFIX}${A.campaign.id}` },
  });
  check("A platform fee = 5M", Number(feeA.amount), 5_000_000);
  check("A fee AVAILABLE", feeA.status, "AVAILABLE");
  const earningA = await prisma.ledgerEntry.findFirstOrThrow({
    where: { conversionId: convA.id, type: "CREATOR_EARNING" },
  });
  check("A creator earning gross (no deduction)", Number(earningA.amount), 100_000_000);

  // ---------- Scenario B: goal reached -> auto-close + fee ----------
  const B = await makeActiveCampaign({ name: "B goal", budget: 100_000_000, reward: 10_000_000, conversionGoal: 2 });
  const convB1 = await pendingConversion(B.campaign.id, B.link.id, 10_000_000);
  const convB2 = await pendingConversion(B.campaign.id, B.link.id, 10_000_000);
  const resB1 = await approve(bizToken, convB1.id);
  check("B approve#1 -> 200", resB1.status, 200);
  check("B not closed after #1", resB1.body.autoClosed, false);
  const resB2 = await approve(bizToken, convB2.id);
  check("B approve#2 -> 200", resB2.status, 200);
  check("B autoCloseReason (GOAL_REACHED)", resB2.body.autoCloseReason, "GOAL_REACHED");
  const feeB = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceId: `${CAMPAIGN_FEE_PREFIX}${B.campaign.id}` },
  });
  check("B fee = 20M * 5% = 1M", Number(feeB.amount), 1_000_000);

  // ---------- Scenario C: manual complete via business route + fee idempotency ----------
  const C = await makeActiveCampaign({ name: "C manual", budget: 10_000_000, reward: 1_000_000 });
  const convC = await pendingConversion(C.campaign.id, C.link.id, 1_000_000);
  const resC = await approve(bizToken, convC.id);
  check("C approve -> 200", resC.status, 200);
  check("C still active", resC.body.autoClosed, false);
  const resCComplete = await patchCampaignStatus(bizToken, C.campaign.id, "COMPLETED");
  check("C PATCH COMPLETED -> 200", resCComplete.status, 200);
  const feeC = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceId: `${CAMPAIGN_FEE_PREFIX}${C.campaign.id}` },
  });
  check("C fee = 1M * 5% = 50k", Number(feeC.amount), 50_000);
  const campaignCSettled = await prisma.campaign.findUniqueOrThrow({ where: { id: C.campaign.id } });
  check("C settledAt persisted in DB", campaignCSettled.settledAt !== null, true);

  // Run settle sweep twice -> fee must not duplicate
  const settleRun1 = await fetch(`${BASE}/api/admin/commissions/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": adminToken },
    body: JSON.stringify({}),
  });
  check("settle sweep #1 -> 200", settleRun1.status, 200);
  await fetch(`${BASE}/api/admin/commissions/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": adminToken },
    body: JSON.stringify({}),
  });
  const feeCCount = await prisma.ledgerEntry.count({
    where: { referenceId: `${CAMPAIGN_FEE_PREFIX}${C.campaign.id}` },
  });
  check("C fee idempotent (1 entry after double settle)", feeCCount, 1);

  // ---------- Scenario D: endAt reached -> auto-close (no fee when spend 0) ----------
  const D = await makeActiveCampaign({ name: "D endAt", budget: 1_000_000, endAt: new Date(Date.now() - 60_000) });
  const settleRun2 = await fetch(`${BASE}/api/admin/commissions/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": adminToken },
    body: JSON.stringify({}),
  });
  check("settle -> 200", settleRun2.status, 200);
  const settleRun2Body = await settleRun2.json();
  const closedIds = (settleRun2Body.closed ?? []).map(
    (r: { campaignId: string }) => r.campaignId,
  );
  check("D closed by sweep", closedIds.includes(D.campaign.id), true);
  const campaignD = await prisma.campaign.findUniqueOrThrow({ where: { id: D.campaign.id } });
  check("D status COMPLETED", campaignD.status, "COMPLETED");
  check("D settledAt set", campaignD.settledAt !== null, true);
  const feeD = await prisma.ledgerEntry.count({
    where: { referenceId: `${CAMPAIGN_FEE_PREFIX}${D.campaign.id}` },
  });
  check("D no fee for zero spend", feeD, 0);

  // ---------- Scenario E: budget protection (reversal) ----------
  const E = await makeActiveCampaign({ name: "E budget guard", budget: 1_000_000, reward: 600_000 });
  const convE1 = await pendingConversion(E.campaign.id, E.link.id, 600_000);
  const convE2 = await pendingConversion(E.campaign.id, E.link.id, 600_000);
  const resE1 = await approve(bizToken, convE1.id);
  check("E approve#1 -> 200", resE1.status, 200);
  const resE2 = await approve(bizToken, convE2.id);
  check("E approve#2 -> 409 (BUDGET_EXCEEDED)", resE2.status, 409);
  const convE2After = await prisma.conversion.findUniqueOrThrow({ where: { id: convE2.id } });
  check("E conversion#2 still PENDING", convE2After.status, "PENDING");
  const spentE = (await prisma.campaign.findUniqueOrThrow({ where: { id: E.campaign.id } })).spentAmount;
  check("E spent stays 600k", Number(spentE), 600_000);

  // ---------- Scenario F: concurrent overspend guard ----------
  const F = await makeActiveCampaign({ name: "F concurrency", budget: 1_000_000, reward: 800_000 });
  const convF1 = await pendingConversion(F.campaign.id, F.link.id, 800_000);
  const convF2 = await pendingConversion(F.campaign.id, F.link.id, 800_000);
  const [rf1, rf2] = await Promise.all([approve(bizToken, convF1.id), approve(bizToken, convF2.id)]);
  const statuses = [rf1.status, rf2.status].sort();
  check("F exactly one success + one 409", statuses.join(","), "200,409");
  const spentF = (await prisma.campaign.findUniqueOrThrow({ where: { id: F.campaign.id } })).spentAmount;
  check("F spent stays 800k", Number(spentF), 800_000);

  // ---------- Withdrawal: commission snapshot + fee ledger lifecycle ----------
  await prisma.ledgerEntry.create({
    data: {
      userId: creatorUser.id,
      type: "CREATOR_EARNING",
      status: "AVAILABLE",
      amount: 100_000_000,
      currency: "IRR",
      description: "seed earnings",
    },
  });

  const withdrawalRes = await fetch(`${BASE}/api/creator/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": creatorToken },
    body: JSON.stringify({ amount: "100000000", iban: "IR00", bankName: "test" }),
  });
  check("withdrawal create -> 200", withdrawalRes.status, 200);
  const w1 = (await withdrawalRes.json()).withdrawal;
  check("W1 gross == amount", Number(w1.grossAmount), Number(w1.amount));
  check("W1 commissionRate snapshot 15", Number(w1.commissionRate), Number(CREATOR_COMMISSION_RATE));
  check("W1 commissionAmount 15M", Number(w1.commissionAmount), 15_000_000);
  check("W1 netAmount 85M", Number(w1.netAmount), 85_000_000);

  const feeW1 = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceId: `${WITHDRAWAL_FEE_PREFIX}${w1.id}` },
  });
  check("W1 fee ledger PENDING 15M", feeW1.status === "PENDING" && Number(feeW1.amount) === 15_000_000, true);

  // Balance after request: available = earnings - active withdrawal gross (100M)
  const earningsAgg = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { userId: creatorUser.id, type: "CREATOR_EARNING", status: "AVAILABLE" },
  });
  const earningsAtW1 = Number(earningsAgg._sum.amount ?? 0);
  const balanceAfterRequest = (await getAvailableBalance(prisma, creatorUser.id)).toNumber();
  check("W1 balance math: balance = earnings - 100M", balanceAfterRequest, earningsAtW1 - 100_000_000);

  // Approve W1 -> COMPLETED + fee AVAILABLE
  const processW1 = await fetch(`${BASE}/api/admin/withdrawals/${w1.id}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": adminToken },
    body: JSON.stringify({ action: "APPROVE" }),
  });
  check("W1 process approve -> 200", processW1.status, 200);
  const feeW1After = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceId: `${WITHDRAWAL_FEE_PREFIX}${w1.id}` },
  });
  check("W1 fee AVAILABLE after approve", feeW1After.status, "AVAILABLE");

  // Double process -> 400, no second fee
  const processW1Again = await fetch(`${BASE}/api/admin/withdrawals/${w1.id}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": adminToken },
    body: JSON.stringify({ action: "APPROVE" }),
  });
  check("W1 double process -> 400", processW1Again.status, 400);
  const feeW1Count = await prisma.ledgerEntry.count({
    where: { referenceId: `${WITHDRAWAL_FEE_PREFIX}${w1.id}` },
  });
  check("W1 single fee entry", feeW1Count, 1);

  // Reject flow: fund more, request, reject -> FAILED + fee REVERSED + balance restored
  await prisma.ledgerEntry.create({
    data: {
      userId: creatorUser.id,
      type: "CREATOR_EARNING",
      status: "AVAILABLE",
      amount: 50_000_000,
      currency: "IRR",
      description: "seed earnings 2",
    },
  });
  const withdrawalRes2 = await fetch(`${BASE}/api/creator/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": creatorToken },
    body: JSON.stringify({ amount: "30000000", iban: "IR11", bankName: "test2" }),
  });
  check("withdrawal2 create -> 200", withdrawalRes2.status, 200);
  const w2 = (await withdrawalRes2.json()).withdrawal;
  check("W2 fee 4.5M", Number(w2.commissionAmount), 4_500_000);
  const rejectW2 = await fetch(`${BASE}/api/admin/withdrawals/${w2.id}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": adminToken },
    body: JSON.stringify({ action: "REJECT", failureReason: "test reject" }),
  });
  check("W2 process reject -> 200", rejectW2.status, 200);
  check("W2 status FAILED", (await rejectW2.json()).withdrawal.status, "FAILED");
  const feeW2 = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceId: `${WITHDRAWAL_FEE_PREFIX}${w2.id}` },
  });
  check("W2 fee REVERSED", feeW2.status, "REVERSED");

  // Balance restored exactly after reject: FAILED withdrawals no longer subtract,
  // and the fee does NOT touch creator balance
  const earningsAgg2 = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { userId: creatorUser.id, type: "CREATOR_EARNING", status: "AVAILABLE" },
  });
  const earningsAtReject = Number(earningsAgg2._sum.amount ?? 0);
  const balanceAfterReject = (await getAvailableBalance(prisma, creatorUser.id)).toNumber();
  check(
    "balance restored after W2 reject = earnings - 100M (W1 only)",
    balanceAfterReject,
    earningsAtReject - 100_000_000,
  );
  const activeWithdrawals = await prisma.withdrawal.aggregate({
    _sum: { amount: true },
    where: { userId: creatorUser.id, status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] } },
  });
  check("active withdrawals = 100M (W2 FAILED not counted)", Number(activeWithdrawals._sum.amount ?? 0), 100_000_000);

  // ---------- Admin commissions API totals ----------
  const commsRes = await fetch(`${BASE}/api/admin/commissions`, {
    method: "GET",
    headers: { "x-session-token": adminToken },
  });
  check("admin commissions GET -> 200", commsRes.status, 200);
  const comms = await commsRes.json();
  check("config rates exposed", `${comms.config.businessRate},${comms.config.creatorRate}`, "5,15");

  // API totals must match what a same-scope aggregate over the ledger returns
  const expectedCampaignFees = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { type: "PLATFORM_FEE", status: "AVAILABLE", referenceId: { startsWith: CAMPAIGN_FEE_PREFIX } },
  });
  const expectedWithdrawalFees = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { type: "PLATFORM_FEE", status: "AVAILABLE", referenceId: { startsWith: WITHDRAWAL_FEE_PREFIX } },
  });
  check("totals.campaignFees matches DB", comms.totals.campaignFees, Number(expectedCampaignFees._sum.amount ?? 0));
  check("totals.withdrawalFees matches DB", comms.totals.withdrawalFees, Number(expectedWithdrawalFees._sum.amount ?? 0));
  checkGt("totals.withdrawalFees >= 15M", comms.totals.withdrawalFees, 15_000_000);
  check("totals.pendingFees = 0", comms.totals.pendingFees, 0);
  checkGt("totals.reversedFees >= 4.5M", comms.totals.reversedFees, 4_500_000);
  check("totals.campaignFees covers A+B+C (>= 6.05M)", comms.totals.campaignFees >= 6_050_000, true);
  checkGt("history length >= 4", comms.history.length, 4);

  // Settlement snapshot preserved on record
  const settlementNow = calculateWithdrawalSettlement(new Prisma.Decimal(100_000_000));
  check(
    "W1 snapshot matches current config",
    Number(w1.commissionAmount) === Number(settlementNow.commissionAmount) &&
      Number(w1.netAmount) === Number(settlementNow.netAmount),
    true,
  );

  console.log(failures === 0 ? "\nALL TESTS PASSED ✅" : `\n${failures} TESTS FAILED ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
