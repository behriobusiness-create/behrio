"use client";

import { useState } from "react";
import { formatCompact, formatNumber } from "@/lib/stats";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 68;
  const c = 2 * Math.PI * r;

  const segments = data.map((d, i) => {
    const prior = data.slice(0, i).reduce((s, x) => s + x.value, 0);
    const len = total > 0 ? (d.value / total) * c : 0;
    const offset = total > 0 ? -(prior / total) * c : 0;
    return { ...d, len, offset };
  });

  const label = (i: number) => data[i].label;
  const value = (i: number) => data[i].value;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <svg viewBox="0 0 160 160" width="168" height="168">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#1a201b" strokeWidth="20" />
          {segments.map((s, i) => (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={active === i ? 24 : 20}
              strokeDasharray={`${Math.max(s.len, 0)} ${c}`}
              strokeDashoffset={s.offset}
              transform="rotate(-90 80 80)"
              style={{ transition: "stroke-width 150ms ease, opacity 150ms ease" }}
              opacity={active === null || active === i ? 1 : 0.4}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-subtle">{centerLabel}</span>
          <span className="tabular mt-0.5 text-lg font-semibold text-fg">
            {active !== null ? formatCompact(value(active)) : centerValue}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2.5">
        {segments.map((s, i) => (
          <li
            key={i}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-hover"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="truncate text-xs text-muted">{label(i)}</span>
            </span>
            <span className="tabular text-xs font-medium text-fg">
              {formatNumber(value(i))}
              {total > 0 && (
                <span className="text-subtle">
                  {" "}
                  · {formatCompact((value(i) / total) * 100)}٪
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
