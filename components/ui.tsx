import React from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-card ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between p-5">
      <div>
        <p className="text-xs font-medium text-subtle">{label}</p>
        <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-fg">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      </div>
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-hover text-muted">
          {icon}
        </span>
      )}
    </Card>
  );
}

const badgeTones: Record<string, string> = {
  default: "border-line bg-hover text-muted",
  green: "border-primary/25 bg-primary/10 text-primary-soft",
  amber: "border-warn/25 bg-warn/10 text-warn",
  red: "border-danger/25 bg-danger/10 text-danger",
  blue: "border-info/25 bg-info/10 text-info",
  violet: "border-[#a78bfa]/25 bg-[#a78bfa]/10 text-[#c4b5fd]",
};

export function Badge({
  children,
  tone = "default",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled,
  loading,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-bg hover:bg-primary-bright",
    secondary: "border border-line bg-surface text-muted hover:bg-hover hover:text-fg",
    success: "bg-primary text-bg hover:bg-primary-bright",
    danger: "border border-danger/30 bg-transparent text-danger hover:bg-danger/10",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`rounded-card px-4 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading ? "..." : children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder-subtle outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15";

export const labelClass = "mb-1.5 block text-sm font-medium text-muted";
