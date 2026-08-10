import Link from "next/link";

export function Logo({
  href = "/",
  className = "",
  light = false,
}: {
  href?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 ${className}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
          light ? "bg-card text-fg border border-line" : "bg-primary text-bg"
        }`}
      >
        B
      </span>
      <span
        className={`text-lg font-semibold tracking-tight ${
          light ? "text-fg" : "text-fg"
        }`}
      >
        Behrio
      </span>
    </Link>
  );
}
