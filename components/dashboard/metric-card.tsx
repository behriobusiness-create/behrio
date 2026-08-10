import { IconTrendingUp, IconTrendingDown } from "@/components/icons";
import { formatPercent } from "@/lib/stats";

function Sparkline({ points }: { points: number[] }) {
  const w = 72;
  const h = 28;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / Math.max(points.length - 1, 1);

  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  spark,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  icon?: React.ReactNode;
  spark?: number[];
  hint?: string;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const positive = hasDelta && (delta as number) >= 0;

  return (
    <div className="group rounded-card border border-line bg-card p-5 transition-colors duration-200 hover:bg-hover">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-subtle">{label}</span>
        {icon && <span className="text-subtle transition-colors group-hover:text-muted">{icon}</span>}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="tabular text-2xl font-semibold tracking-tight text-fg">
          {value}
        </span>
        {spark && spark.length > 1 && <Sparkline points={spark} />}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        {hasDelta ? (
          <>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular ${
                positive ? "text-primary-bright" : "text-danger"
              }`}
            >
              {positive ? (
                <IconTrendingUp className="h-3.5 w-3.5" />
              ) : (
                <IconTrendingDown className="h-3.5 w-3.5" />
              )}
              {formatPercent(Math.abs(delta as number), 1)}
            </span>
            <span className="text-xs text-subtle">
              {deltaLabel ?? "نسبت به دوره قبل"}
            </span>
          </>
        ) : (
          <span className="text-xs text-subtle">{deltaLabel ?? "—"}</span>
        )}
      </div>

      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
