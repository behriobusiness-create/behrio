"use client";

import { useEffect, useState } from "react";
import ApplyButton from "@/components/apply-button";
import { IconX, IconLink } from "@/components/icons";

export type CampaignView = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  accessType: string;
  budget: number;
  destinationUrl: string;
  rewardPerClick: number | null;
  rewardPerConversion: number | null;
  rewardPerThousand: number | null;
  commissionPercent: number | null;
  clickRewardPerGroup: number | null;
  business: string;
  applicationStatus?: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
};

function formatPercent(n: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(n)}٪`;
}

function rewardLabel(type: string, group: number | null): string {
  switch (type) {
    case "CPC":
    case "CPA":
      return `به‌ازای هر ${group && group > 1 ? new Intl.NumberFormat("fa-IR").format(group) : ""} کلیک`;
    case "CPM":
    case "CLIPPING":
      return "به‌ازای هر ۱۰۰۰ نمایش";
    case "AFFILIATE":
      return "کمیسیون از فروش";
    default:
      return "پاداش";
  }
}

function rewardRows(c: CampaignView): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if ((c.type === "CPC" || c.type === "CPA") && c.rewardPerClick != null) {
    rows.push({
      label: rewardLabel(c.type, c.clickRewardPerGroup),
      value: formatRials(c.rewardPerClick),
    });
  }
  if ((c.type === "CPM" || c.type === "CLIPPING") && c.rewardPerThousand != null) {
    rows.push({
      label: "به‌ازای هر ۱۰۰۰ نمایش",
      value: formatRials(c.rewardPerThousand),
    });
  }
  if (c.type === "AFFILIATE") {
    rows.push({
      label: "کمیسیون از فروش",
      value:
        c.commissionPercent != null
          ? formatPercent(c.commissionPercent)
          : c.rewardPerConversion != null
            ? formatRials(c.rewardPerConversion)
            : "—",
    });
  }
  return rows;
}

const typeLabels: Record<string, string> = {
  CPC: "پرداخت به‌ازای کلیک",
  CPA: "پرداخت گروهی به‌ازای کلیک",
  CPM: "پرداخت به‌ازای هزار نمایش",
  AFFILIATE: "همکاری فروش",
  CLIPPING: "کلیپینگ",
};

const typeTone: Record<string, string> = {
  CPC: "border-info/25 bg-info/10 text-info",
  CPA: "border-primary/25 bg-primary/10 text-primary-soft",
  CPM: "border-warn/25 bg-warn/10 text-warn",
  AFFILIATE: "border-line bg-hover text-muted",
  CLIPPING: "border-line bg-hover text-muted",
};

function formatRials(n: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(n))} تومان`;
}

export function CampaignGrid({ campaigns }: { campaigns: CampaignView[] }) {
  const [open, setOpen] = useState<CampaignView | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-card p-12 text-center">
        <p className="text-lg font-semibold text-subtle">
          در حال حاضر کمپین فعالی وجود ندارد.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="flex flex-col rounded-2xl border border-line bg-card p-6 transition hover:border-line hover:bg-hover"
          >
            <div className="flex items-start justify-between">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeTone[campaign.type] ?? "border-line bg-hover text-muted"}`}
              >
                {typeLabels[campaign.type] ?? campaign.type}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  campaign.accessType === "OPEN"
                    ? "border-info/25 bg-info/10 text-info"
                    : "border-warn/25 bg-warn/10 text-warn"
                }`}
              >
                {campaign.accessType === "OPEN" ? "باز" : "با تأیید"}
              </span>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-fg">
              {campaign.name}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{campaign.business}</p>

            {campaign.description && (
              <p className="mt-3 line-clamp-2 text-sm leading-7 text-muted">
                {campaign.description}
              </p>
            )}

            <div className="mt-4 space-y-2 text-sm">
              {rewardRows(campaign).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg bg-hover px-3 py-2"
                >
                  <span className="text-subtle">{row.label}</span>
                  <span className="font-semibold text-fg">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-2 pt-5">
              <button
                type="button"
                onClick={() => setOpen(campaign)}
                className="w-full rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-hover"
              >
                مشاهده جزئیات
              </button>
              <ApplyButton
                campaignId={campaign.id}
                initialStatus={campaign.applicationStatus ?? "NONE"}
              />
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onClick={() => setOpen(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-card shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-fg">{open.name}</h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeTone[open.type] ?? "border-line bg-hover text-muted"}`}
                  >
                    {typeLabels[open.type] ?? open.type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {open.business} ·{" "}
                  {open.accessType === "OPEN" ? "همکاری باز" : "همکاری با تأیید"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="shrink-0 rounded-lg p-1.5 text-subtle transition-colors hover:bg-hover hover:text-fg"
                aria-label="بستن"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <div>
                <h3 className="text-sm font-semibold text-fg">درباره کمپین</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted">
                  {open.description || "توضیحاتی ثبت نشده است."}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-fg">پاداش‌ها</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {rewardRows(open).map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-lg bg-hover px-4 py-3"
                    >
                      <span className="text-xs text-subtle">{row.label}</span>
                      <span className="text-sm font-semibold text-fg">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-fg">اطلاعات بیشتر</h3>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg px-4 py-3">
                  <span className="text-xs text-subtle">
                    بودجه کمپین:{" "}
                    <span className="font-semibold text-fg">
                      {formatRials(open.budget)}
                    </span>
                  </span>
                  {open.destinationUrl && (
                    <a
                      href={open.destinationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-primary-soft transition-colors hover:bg-hover"
                    >
                      <IconLink className="h-3.5 w-3.5 shrink-0" />
                      <span dir="ltr" className="truncate">
                        {open.destinationUrl}
                      </span>
                    </a>
                  )}
                </div>
              </div>

              <div className="border-t border-line pt-5">
                <ApplyButton
                  campaignId={open.id}
                  initialStatus={open.applicationStatus ?? "NONE"}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}