"use client";

import { usePathname, useRouter } from "next/navigation";
import { IconCalendar } from "@/components/icons";

const RANGES = [
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۹۰ روز" },
  { days: 365, label: "۱ سال" },
];

export function DateRangeSelector({ defaultRange = 30 }: { defaultRange?: number }) {
  const router = useRouter();
  const pathname = usePathname();

  const update = (days: number) => {
    const params = new URLSearchParams(window.location.search);
    if (days === 30) {
      params.delete("range");
    } else {
      params.set("range", String(days));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      <span className="px-2 text-subtle">
        <IconCalendar className="h-3.5 w-3.5" />
      </span>
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          onClick={() => update(r.days)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
            defaultRange === r.days
              ? "bg-hover text-fg"
              : "text-subtle hover:text-muted"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
