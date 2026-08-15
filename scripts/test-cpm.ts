import { Prisma } from "../app/generated/prisma/client";
import {
  CPM_IMPRESSIONS_PER_UNIT,
  calculateCpmEarnings,
  calculateCpmGroups,
  formatCpmCalculation,
  parseCpm,
  parseMoney,
  parsePositiveBudget,
  validateClaimedImpressions,
  validateImpressions,
} from "../lib/finance/cpm";

let failures = 0;

function check(desc: string, actual: unknown, expected: unknown) {
  const ok =
    actual === expected ||
    (actual instanceof Prisma.Decimal &&
      DecimalEq(actual, expected as Prisma.Decimal | number));
  if (!ok) failures += 1;
  console.log(
    `${ok ? "✅" : "❌"} ${desc} -> ${String(actual)} (expected ${String(expected)})`
  );
  return ok;
}

function DecimalEq(a: Prisma.Decimal, b: Prisma.Decimal | number): boolean {
  return a.equals(b);
}

function main() {
  // ---------- Groups (floor at the 1000 boundary) ----------
  check("groups(0) = 0", calculateCpmGroups(0), 0);
  check("groups(1) = 0", calculateCpmGroups(1), 0);
  check("groups(999) = 0", calculateCpmGroups(999), 0);
  check("groups(1000) = 1", calculateCpmGroups(1000), 1);
  check("groups(1001) = 1", calculateCpmGroups(1001), 1);
  check("groups(1999) = 1", calculateCpmGroups(1999), 1);
  check("groups(2000) = 2", calculateCpmGroups(2000), 2);
  check("groups(5_000_000) = 5000", calculateCpmGroups(5_000_000), 5000);
  check("CPM_IMPRESSIONS_PER_UNIT is 1000", CPM_IMPRESSIONS_PER_UNIT, 1000);

  // ---------- Earnings (cpm × groups, HALF_UP, 0 dp) ----------
  const cpm = new Prisma.Decimal(200_000);
  check(
    "earnings(0) = 0",
    calculateCpmEarnings(0, cpm).toNumber(),
    0
  );
  check(
    "earnings(999) = 0",
    calculateCpmEarnings(999, cpm).toNumber(),
    0
  );
  check(
    "earnings(1000) = 200000",
    calculateCpmEarnings(1000, cpm).toNumber(),
    200_000
  );
  check(
    "earnings(1001) = 200000",
    calculateCpmEarnings(1001, cpm).toNumber(),
    200_000
  );
  check(
    "earnings(2500) = 400000 (2 groups)",
    calculateCpmEarnings(2500, cpm).toNumber(),
    400_000
  );

  // Decimal CPM: 12000.5 × 3 groups = 36001.5 → HALF_UP → 36002
  const decimalCpm = new Prisma.Decimal("12000.50");
  check(
    "decimal cpm earnings(3500) = 36002",
    calculateCpmEarnings(3500, decimalCpm).toNumber(),
    36_002
  );

  // Decimal CPM: 12000.499 × 2 groups = 24000.998 → HALF_UP → 24001
  const decimalCpm2 = new Prisma.Decimal("12000.499");
  check(
    "decimal cpm earnings(2000) = 24001",
    calculateCpmEarnings(2000, decimalCpm2).toNumber(),
    24_001
  );

  // Large counts: 10_000_000 → 10,000 groups × cpm 50 = 500,000
  check(
    "earnings(10_000_000) = 500000",
    calculateCpmEarnings(10_000_000, new Prisma.Decimal(50)).toNumber(),
    500_000
  );

  // ---------- Money parsing ----------
  check("parseMoney('" + "1234.56' = 1234.56", parseMoney("1234.56")?.toNumber(), 1234.56);
  check("parseMoney(1000) = 1000", parseMoney(1000)?.toNumber(), 1000);
  check("parseMoney('abc') = null", parseMoney("abc"), null);
  check("parseMoney('1.234') = null", parseMoney("1.234"), null);
  check("parseMoney('') = null", parseMoney(""), null);
  check("parseMoney('0') = 0", parseMoney("0")?.toNumber(), 0);
  check("parseMoney('-5') = null", parseMoney("-5"), null);
  check("parseMoney('1e3') = null", parseMoney("1e3"), null);

  // ---------- CPM validation ----------
  check("parseCpm('300000').ok", parseCpm("300000").ok, true);
  check("parseCpm('300000').value", parseCpm("300000").value?.toNumber(), 300_000);
  check("parseCpm('0') rejected", parseCpm("0").ok, false);
  check("parseCpm('-100') rejected", parseCpm("-100").ok, false);
  check("parseCpm('abc') rejected", parseCpm("abc").ok, false);
  check("parseCpm('1.25').ok", parseCpm("1.25").ok, true);
  check("parseCpm('1.999') rejected", parseCpm("1.999").ok, false);
  check("parseCpm(null) rejected", parseCpm(null).ok, false);

  // ---------- Budget validation ----------
  check("parsePositiveBudget('1_000_000') rejected", parsePositiveBudget("1_000_000").ok, false);
  check("parsePositiveBudget('1000000').ok", parsePositiveBudget("1000000").ok, true);
  check("parsePositiveBudget('0') rejected", parsePositiveBudget("0").ok, false);

  // ---------- Impressions validation ----------
  check("validateImpressions(500) = 500", validateImpressions(500), 500);
  check("validateImpressions('500') = 500", validateImpressions("500"), 500);
  check("validateImpressions(0) = 0", validateImpressions(0), 0);
  check("validateImpressions(-1) = null", validateImpressions(-1), null);
  check("validateImpressions(1.5) = null", validateImpressions(1.5), null);
  check("validateImpressions('abc') = null", validateImpressions("abc"), null);
  check("validateImpressions(undefined) = null", validateImpressions(undefined), null);

  check("validateClaimedImpressions(1).ok", validateClaimedImpressions(1).ok, true);
  check("validateClaimedImpressions(0) rejected", validateClaimedImpressions(0).ok, false);
  check("validateClaimedImpressions(-5) rejected", validateClaimedImpressions(-5).ok, false);

  // ---------- Formatting ----------
  const formatted = formatCpmCalculation(2500, cpm);
  check(
    "formatCpmCalculation(2500, 200000) shows formula",
    formatted,
    "2,500 × (200000 / 1000) = 400000"
  );

  console.log(
    failures === 0 ? "\nALL CPM TESTS PASSED ✅" : `\n${failures} CPM TESTS FAILED ❌`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();