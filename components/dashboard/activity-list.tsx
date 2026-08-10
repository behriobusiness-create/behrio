import {
  IconCoins,
  IconBank,
  IconTarget,
  IconUsers,
  IconRocket,
  IconActivity,
} from "@/components/icons";
import { EmptyState } from "./section-card";

export type ActivityItem = {
  id: string;
  kind:
    | "earning"
    | "withdrawal"
    | "conversion"
    | "application"
    | "campaign"
    | "user"
    | "spend";
  title: string;
  description?: string;
  amount?: { text: string; tone: "pos" | "neg" | "neutral" };
  time: Date;
};

const kinds: Record<
  ActivityItem["kind"],
  { icon: React.ReactNode; className: string }
> = {
  earning: {
    icon: <IconCoins className="h-4 w-4" />,
    className: "border-primary/25 bg-primary/10 text-primary-soft",
  },
  conversion: {
    icon: <IconTarget className="h-4 w-4" />,
    className: "border-primary/25 bg-primary/10 text-primary-bright",
  },
  withdrawal: {
    icon: <IconBank className="h-4 w-4" />,
    className: "border-warn/25 bg-warn/10 text-warn",
  },
  application: {
    icon: <IconUsers className="h-4 w-4" />,
    className: "border-info/25 bg-info/10 text-info",
  },
  campaign: {
    icon: <IconRocket className="h-4 w-4" />,
    className: "border-line bg-hover text-muted",
  },
  user: {
    icon: <IconUsers className="h-4 w-4" />,
    className: "border-line bg-hover text-muted",
  },
  spend: {
    icon: <IconCoins className="h-4 w-4" />,
    className: "border-line bg-hover text-muted",
  },
};

const rel = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });

function timeAgo(date: Date): string {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "همین حالا";
  if (abs < 3_600_000) return rel.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rel.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 7 * 86_400_000)
    return rel.format(Math.round(diff / 86_400_000), "day");
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

const amountTones: Record<string, string> = {
  pos: "text-primary-soft",
  neg: "text-danger",
  neutral: "text-muted",
};

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconActivity className="h-5 w-5" />}
        title="هنوز فعالیتی ثبت نشده است"
      />
    );
  }

  return (
    <ul className="divide-y divide-line/60">
      {items.map((item) => {
        const meta = kinds[item.kind];
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-hover"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.className}`}
            >
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                {item.title}
              </p>
              {item.description && (
                <p className="truncate text-xs text-subtle">{item.description}</p>
              )}
            </div>
            <div className="shrink-0 text-left">
              {item.amount && (
                <p
                  className={`tabular text-sm font-semibold ${amountTones[item.amount.tone] ?? "text-muted"}`}
                >
                  {item.amount.text}
                </p>
              )}
              <p className="text-[11px] text-subtle">{timeAgo(item.time)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
