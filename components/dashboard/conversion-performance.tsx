import {
  IconMousePointer,
  IconTarget,
  IconPercent,
  IconDollar,
} from "@/components/icons";
import { formatNumber, formatPercent, formatRials } from "@/lib/stats";

export function ConversionPerformance({
  clicks,
  conversions,
  rate,
  avgValue,
  clickColor = "#86efac",
  conversionColor = "#4ade80",
}: {
  clicks: number;
  conversions: number;
  rate: number | null;
  avgValue: number;
  clickColor?: string;
  conversionColor?: string;
}) {
  const items = [
    {
      label: "کلیک‌ها",
      value: formatNumber(clicks),
      icon: <IconMousePointer className="h-4 w-4" />,
      color: clickColor,
      ratio: clicks > 0 ? 1 : 0,
    },
    {
      label: "تبدیل‌ها",
      value: formatNumber(conversions),
      icon: <IconTarget className="h-4 w-4" />,
      color: conversionColor,
      ratio: clicks > 0 ? conversions / clicks : 0,
    },
    {
      label: "نرخ تبدیل",
      value: rate === null ? "—" : formatPercent(rate),
      icon: <IconPercent className="h-4 w-4" />,
      color: "#22c55e",
      ratio: rate === null ? 0 : Math.min(rate / 100, 1),
    },
    {
      label: "میانگین ارزش",
      value: formatRials(avgValue),
      icon: <IconDollar className="h-4 w-4" />,
      color: "#7dd3fc",
      ratio: avgValue > 0 ? 1 : 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-line bg-bg p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-subtle">{item.label}</span>
            <span style={{ color: item.color }}>{item.icon}</span>
          </div>
          <p className="tabular mt-2 text-xl font-semibold text-fg">
            {item.value}
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-hover">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(item.ratio * 100, 3)}%`,
                background: item.color,
                opacity: 0.7,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
