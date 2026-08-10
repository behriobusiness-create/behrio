export const campaignStatusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING_REVIEW: "در انتظار بررسی",
  ACTIVE: "فعال",
  PAUSED: "متوقف",
  COMPLETED: "تکمیل شده",
  CANCELLED: "لغو شده",
};

export const withdrawalStatusLabels: Record<string, string> = {
  REQUESTED: "درخواست‌شده",
  PROCESSING: "در حال پردازش",
  COMPLETED: "تکمیل شده",
  FAILED: "ناموفق",
  CANCELLED: "لغو شده",
};

export const applicationStatusLabels: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  WITHDRAWN: "انصراف داده",
};

const tones: Record<string, string> = {
  green: "border-primary/25 bg-primary/10 text-primary-soft",
  amber: "border-warn/25 bg-warn/10 text-warn",
  gray: "border-line bg-hover text-muted",
  red: "border-danger/25 bg-danger/10 text-danger",
  blue: "border-info/25 bg-info/10 text-info",
};

const statusTone: Record<string, keyof typeof tones> = {
  ACTIVE: "green",
  APPROVED: "green",
  COMPLETED: "green",
  PENDING_REVIEW: "amber",
  PENDING: "amber",
  PROCESSING: "amber",
  REQUESTED: "amber",
  DRAFT: "gray",
  PAUSED: "gray",
  WITHDRAWN: "gray",
  FAILED: "red",
  REJECTED: "red",
  CANCELLED: "red",
};

export function StatusBadge({
  status,
  label,
  className = "",
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = statusTone[status] ?? "gray";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label ?? status}
    </span>
  );
}
