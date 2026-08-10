const DAY_MS = 24 * 60 * 60 * 1000;

export type SeriesPoint = {
  key: string;
  label: string;
  value: number;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function makeDayBuckets(days: number): { key: string; label: string; date: Date }[] {
  const now = new Date();
  const buckets: { key: string; label: string; date: Date }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    buckets.push({
      key: dayKey(d),
      label: new Intl.DateTimeFormat("fa-IR", {
        day: "numeric",
        month: "short",
      }).format(d),
      date: d,
    });
  }
  return buckets;
}

export function bucketByDay(
  rows: { date: Date; value: number }[],
  days: number,
): SeriesPoint[] {
  const buckets = makeDayBuckets(days);
  const sums = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(row.date);
    sums.set(key, (sums.get(key) ?? 0) + row.value);
  }
  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: sums.get(b.key) ?? 0,
  }));
}

export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    return current > 0 ? 100 : current < 0 ? -100 : 0;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

const faNumber = new Intl.NumberFormat("fa-IR");

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "۰";
  return faNumber.format(Math.round(n));
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "۰";
  return new Intl.NumberFormat("fa-IR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatRials(n: number): string {
  return `${formatNumber(n)} تومان`;
}

export function formatPercent(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "۰٪";
  return `${new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: digits,
  }).format(n)}٪`;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export type DatedRow = { date: Date; value: number };

export function splitPeriods(
  rows: DatedRow[],
  recentDays: number,
): { current: number; previous: number } {
  const now = new Date();
  const recentStart = new Date(now.getTime() - recentDays * DAY_MS);
  const prevStart = new Date(now.getTime() - 2 * recentDays * DAY_MS);

  let current = 0;
  let previous = 0;
  for (const row of rows) {
    if (row.date >= recentStart) {
      current += row.value;
    } else if (row.date >= prevStart) {
      previous += row.value;
    }
  }
  return { current, previous };
}

export function parseRange(value: string | null | undefined): number {
  const parsed = Number(value);
  if (parsed === 7 || parsed === 90 || parsed === 365) return parsed;
  return 30;
}
