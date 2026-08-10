import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { isProduction } from "../lib/env";
import { isRateLimited } from "../lib/rate-limit";
import { generateOtp, hashOtp, verifyOtpHash, MAX_OTP_ATTEMPTS } from "../lib/auth/otp";
import { campaignHasCapacity } from "../lib/campaign/capacity";
import { Prisma } from "../app/generated/prisma/client";

const BASE = "http://localhost:3000";

let failures = 0;

function check(desc: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "✅" : "❌"} ${desc} -> ${String(actual)} (expected ${String(expected)})`,
  );
  return ok;
}

async function main() {
  const unique = Date.now().toString(36);

  // ---------- A: Sandbox gate ----------
  const prodGate = isProduction();
  if (prodGate) {
    // In production the gate must be tested against a deployed instance;
    // here we verify the check exists before any auth/DB work.
    const src = await import("node:fs");
    const { readFileSync } = src;
    const route = readFileSync(
      "./app/api/payments/sandbox/route.ts",
      "utf-8",
    );
    const gateIndex = route.indexOf("isProduction()");
    const authIndex = route.indexOf("getCurrentUser()");
    check("sandbox gate precedes auth", gateIndex >= 0 && gateIndex < authIndex, true);
  } else {
    const sandboxRes = await fetch(`${BASE}/api/payments/sandbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 100000 }),
    }).catch(() => null);
    if (sandboxRes) {
      check("sandbox -> 401 (no auth) in dev", sandboxRes.status, 401);
    } else {
      console.log("⚠️ API server not running — skipping sandbox gate");
    }
  }

  // ---------- B: OTP brute-force guard ----------
  const code1 = generateOtp();
  const code2 = generateOtp();
  check("OTP codes are 6-digit", /^\d{6}$/.test(code1), true);
  check("OTP codes differ", code1 !== code2, true);

  const hash = await hashOtp(code1);
  check("correct OTP verifies", await verifyOtpHash(code1, hash), true);
  check("wrong OTP rejected", await verifyOtpHash(code2, hash), false);
  check("MAX_OTP_ATTEMPTS <= 10", MAX_OTP_ATTEMPTS <= 10, true);

  // Rate limiter: same key exceeds limit
  const scope = `regression-${unique}`;
  let limited = false;
  for (let i = 0; i < 5; i++) {
    limited = await isRateLimited(scope, "x", 4, 60_000);
  }
  check("rate limiter triggers at limit", limited, true);

  // ---------- C: Marketplace capacity guard (pure function) ----------
  const fullCampaign = {
    id: "x",
    status: "ACTIVE",
    budget: new Prisma.Decimal(100),
    spentAmount: new Prisma.Decimal(100),
    startAt: null,
    endAt: null,
    accessType: "OPEN",
  };
  check("exhausted budget -> no capacity", campaignHasCapacity(fullCampaign).ok, false);

  const notActive = { ...fullCampaign, spentAmount: new Prisma.Decimal(50) };
  check("non-ACTIVE -> no capacity", campaignHasCapacity({ ...notActive, status: "PAUSED" }).ok, false);

  const ended = { ...fullCampaign, spentAmount: new Prisma.Decimal(50), endAt: new Date(Date.now() - 1000) };
  check("ended campaign -> no capacity", campaignHasCapacity(ended).ok, false);

  const open = { ...fullCampaign, spentAmount: new Prisma.Decimal(50) };
  check("active with remaining budget -> capacity", campaignHasCapacity(open).ok, true);

  // ---------- D: Conversion API key validation (no network, via existing script cover) ----------
  // Covered by scripts/test-conversion-api.ts; here verify the API route rejects a bad key.
  const badKeyRes = await fetch(`${BASE}/api/v1/integrations/conversions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${randomBytes(16).toString("hex")}`,
    },
    body: JSON.stringify({ trackingLinkCode: "nonexistent" }),
  }).catch(() => null);

  if (badKeyRes) {
    const body = await badKeyRes.json().catch(() => ({}));
    check("bad API key -> 401", badKeyRes.status, 401);
    check("bad API key error UNAUTHORIZED", body.error, "UNAUTHORIZED");
  } else {
    console.log("⚠️ API server not running — skipping network D");
  }

  // ---------- E: Withdrawal commission constants (pure) ----------
  const { BUSINESS_COMMISSION_RATE, CREATOR_COMMISSION_RATE } = await import(
    "../lib/finance/commission"
  );
  check("business rate 5%", BUSINESS_COMMISSION_RATE.toNumber(), 5);
  check("creator rate 15%", CREATOR_COMMISSION_RATE.toNumber(), 15);

  console.log(failures === 0 ? "\nALL TESTS PASSED ✅" : `\n${failures} TESTS FAILED ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
