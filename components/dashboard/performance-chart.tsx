"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SectionCard } from "./section-card";
import { formatCompact, formatNumber, formatRials } from "@/lib/stats";

type Metric = "revenue" | "conversions" | "clicks";

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: "revenue", label: "درآمد", color: "#22c55e" },
  { key: "conversions", label: "تبدیل‌ها", color: "#4ade80" },
  { key: "clicks", label: "کلیک‌ها", color: "#86efac" },
];

export type ChartPoint = {
  label: string;
  revenue: number;
  conversions: number;
  clicks: number;
};

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const nice =
    frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

function formatValue(metric: Metric, value: number): string {
  if (metric === "revenue") return formatRials(value);
  return formatNumber(value);
}

export function PerformanceChart({
  points,
  title,
  subtitle,
}: {
  points: ChartPoint[];
  title?: string;
  subtitle?: string;
}) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  const active = METRICS.find((m) => m.key === metric)!;
  const values = points.map((p) => p[metric]);

  const height = 260;
  const padL = 48;
  const padR = 10;
  const padT = 14;
  const padB = 30;
  const innerW = Math.max(width - padL - padR, 40);
  const innerH = height - padT - padB;

  const maxVal = niceMax(Math.max(...values, 0));
  const n = points.length;
  const xAt = (i: number) =>
    n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(" ");

  const area = `${line} L${xAt(n - 1).toFixed(1)},${padT + innerH} L${xAt(0).toFixed(
    1,
  )},${padT + innerH} Z`;

  const gridTicks = 4;
  const yTicks = Array.from({ length: gridTicks + 1 }, (_, i) => ({
    value: maxVal * (1 - i / gridTicks),
    y: padT + (i / gridTicks) * innerH,
  }));

  const xLabelEvery = Math.max(Math.ceil(n / 6), 1);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - padL) / innerW) * (n - 1));
    setHoverIndex(Math.min(Math.max(i, 0), n - 1));
  };

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? values[hoverIndex] : null;

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-bg p-0.5 w-fit">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                metric === m.key
                  ? "bg-hover text-fg"
                  : "text-subtle hover:text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="relative px-3 pb-3 pt-4">
        {width > 0 && (
          <>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              className="block w-full"
              onMouseMove={handleMove}
              onMouseLeave={() => setHoverIndex(null)}
              role="img"
              aria-label={title ?? "نمودار عملکرد"}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={active.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={active.color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {yTicks.map((t, i) => (
                <g key={i}>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={t.y}
                    y2={t.y}
                    stroke="#202720"
                    strokeWidth="1"
                    strokeDasharray={i === gridTicks ? "0" : "3 4"}
                  />
                  <text
                    x={padL - 8}
                    y={t.y + 3}
                    textAnchor="end"
                    className="fill-subtle"
                    fontSize="10"
                  >
                    {formatCompact(t.value)}
                  </text>
                </g>
              ))}

              <path d={area} fill={`url(#${gradientId})`} />
              <path
                d={line}
                fill="none"
                stroke={active.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {points.map((p, i) => {
                if (i % xLabelEvery !== 0 && i !== n - 1) return null;
                return (
                  <text
                    key={i}
                    x={xAt(i)}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-subtle"
                    fontSize="10"
                  >
                    {p.label}
                  </text>
                );
              })}

              {hoverIndex !== null && (
                <g>
                  <line
                    x1={xAt(hoverIndex)}
                    x2={xAt(hoverIndex)}
                    y1={padT}
                    y2={padT + innerH}
                    stroke="#a1aaa3"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                  <circle
                    cx={xAt(hoverIndex)}
                    cy={yAt(values[hoverIndex])}
                    r="4"
                    fill="#080a09"
                    stroke={active.color}
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {hoverIndex !== null && hoverPoint !== null && hoverValue !== null && (
              <div
                className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 shadow-lg shadow-black/30"
                style={{
                  top: 10,
                  right:
                    xAt(hoverIndex) > width / 2
                      ? undefined
                      : Math.min(xAt(hoverIndex) + 10, width - 150),
                  left:
                    xAt(hoverIndex) <= width / 2
                      ? undefined
                      : Math.max(xAt(hoverIndex) - 160, 10),
                }}
              >
                <p className="text-[11px] text-subtle">{hoverPoint.label}</p>
                <p className="tabular mt-0.5 text-sm font-semibold text-fg">
                  {formatValue(metric, hoverValue)}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
