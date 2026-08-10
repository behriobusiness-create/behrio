import { IconActivity } from "@/components/icons";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-card border border-line bg-card p-5 ${className}`}
    >
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-4 h-7 w-32" />
      <SkeletonBlock className="mt-4 h-3 w-44" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-3 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-9 w-28 rounded-xl" />
          <SkeletonBlock className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="rounded-card border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="h-8 w-48 rounded-lg" />
        </div>
        <SkeletonBlock className="mt-6 h-56 w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-card p-5">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-6 h-44 w-full" />
        </div>
        <div className="rounded-card border border-line bg-card p-5">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-6 h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

export function DashboardError({
  error,
  reset,
  title = "خطا در بارگذاری داشبورد",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-danger">
        <IconActivity className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-subtle">
        {error.message || "خطایی ناخواسته رخ داد. لطفاً دوباره تلاش کنید."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg border border-line bg-hover px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface"
      >
        تلاش مجدد
      </button>
    </div>
  );
}