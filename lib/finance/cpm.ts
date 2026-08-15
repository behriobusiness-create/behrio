import { Prisma } from "@/app/generated/prisma/client";

export const CPM_IMPRESSIONS_PER_UNIT = 1000;

export const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export type MoneyValidation = {
  ok: boolean;
  error: string | null;
  value: Prisma.Decimal | null;
};

export function parseMoney(value: unknown): Prisma.Decimal | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!MONEY_PATTERN.test(raw)) return null;
  return new Prisma.Decimal(raw);
}

export function parseCpm(value: unknown): MoneyValidation {
  const amount = parseMoney(value);
  if (!amount) {
    return {
      ok: false,
      error: "نرخ CPM باید عددی با حداکثر دو رقم اعشار باشد.",
      value: null,
    };
  }
  if (!amount.gt(0)) {
    return { ok: false, error: "نرخ CPM باید بزرگ‌تر از صفر باشد.", value: null };
  }
  return { ok: true, error: null, value: amount };
}

export function parsePositiveBudget(value: unknown): MoneyValidation {
  const amount = parseMoney(value);
  if (!amount) {
    return {
      ok: false,
      error: "بودجه باید عددی با حداکثر دو رقم اعشار باشد.",
      value: null,
    };
  }
  if (!amount.gt(0)) {
    return { ok: false, error: "بودجه کمپین باید بزرگ‌تر از صفر باشد.", value: null };
  }
  return { ok: true, error: null, value: amount };
}

export function validateImpressions(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) return null;
  return num;
}

export function validateClaimedImpressions(value: unknown): {
  ok: boolean;
  error: string | null;
  value: number | null;
} {
  const impressions = validateImpressions(value);
  if (impressions === null || impressions <= 0) {
    return {
      ok: false,
      error: "تعداد نمایش باید عدد صحیح بزرگ‌تر از صفر باشد.",
      value: null,
    };
  }
  return { ok: true, error: null, value: impressions };
}

export function calculateCpmGroups(verifiedImpressions: number): number {
  const groups = Math.floor(verifiedImpressions / CPM_IMPRESSIONS_PER_UNIT);
  return Math.max(groups, 0);
}

export function calculateCpmEarnings(
  verifiedImpressions: number,
  cpm: Prisma.Decimal,
): Prisma.Decimal {
  const groups = calculateCpmGroups(verifiedImpressions);
  return cpm
    .mul(groups)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export function formatCpmCalculation(
  verifiedImpressions: number,
  cpm: Prisma.Decimal,
): string {
  const groups = calculateCpmGroups(verifiedImpressions);
  const earnings = calculateCpmEarnings(verifiedImpressions, cpm);
  return `${verifiedImpressions.toLocaleString("en-US")} × (${cpm.toFixed()} / 1000) = ${earnings.toFixed()}`;
}
