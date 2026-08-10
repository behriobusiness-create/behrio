import Link from "next/link";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./section-card";
import { formatNumber, formatPercent, formatRials } from "@/lib/stats";
import { IconRocket } from "@/components/icons";

export type CampaignRow = {
  id: string;
  name: string;
  business?: string | null;
  status: string;
  statusLabel?: string;
  clicks: number;
  conversions: number;
  earnings: number;
  rate: number | null;
  href?: string;
};

const th = "px-4 py-3 text-xs font-medium text-subtle whitespace-nowrap";
const td = "px-4 py-3.5 whitespace-nowrap";

export function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconRocket className="h-5 w-5" />}
        title="کمپینی ثبت نشده است"
        description="به محض شروع همکاری، عملکرد کمپین‌ها اینجا نمایش داده می‌شود."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-bg/40">
            <th className={`${th} text-right`}>کمپین</th>
            <th className={`${th} text-right`}>کسب‌وکار</th>
            <th className={`${th} text-right`}>وضعیت</th>
            <th className={`${th} text-left`}>کلیک‌ها</th>
            <th className={`${th} text-left`}>تبدیل‌ها</th>
            <th className={`${th} text-left`}>درآمد</th>
            <th className={`${th} text-left`}>نرخ تبدیل</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = (
              <>
                <td className={td}>
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="block max-w-52 truncate text-sm font-medium text-fg transition-colors hover:text-primary-soft"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    <span className="block max-w-52 truncate text-sm font-medium text-fg">
                      {row.name}
                    </span>
                  )}
                </td>
                <td className={`${td} max-w-44 truncate text-sm text-muted`}>
                  {row.business ?? "—"}
                </td>
                <td className={td}>
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </td>
                <td className={`${td} tabular text-left text-sm text-fg`}>
                  {formatNumber(row.clicks)}
                </td>
                <td className={`${td} tabular text-left text-sm text-fg`}>
                  {formatNumber(row.conversions)}
                </td>
                <td className={`${td} tabular text-left text-sm font-semibold text-primary-soft`}>
                  {formatRials(row.earnings)}
                </td>
                <td className={`${td} tabular text-left text-sm text-muted`}>
                  {row.rate === null ? "—" : formatPercent(row.rate)}
                </td>
              </>
            );

            return (
              <tr
                key={row.id}
                className="border-b border-line/60 transition-colors last:border-0 hover:bg-hover"
              >
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
