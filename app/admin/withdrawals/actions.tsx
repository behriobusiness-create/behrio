"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type WithdrawalItem = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  iban: string | null;
  bankName: string | null;
  requestedAt: string;
  creatorName: string | null;
};

export default function WithdrawalActions({
  withdrawal,
}: {
  withdrawal: WithdrawalItem;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  async function run(action: "APPROVE" | "REJECT") {
    setError("");

    const res = await fetch(
      `/api/admin/withdrawals/${withdrawal.id}/process`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          failureReason: action === "REJECT" ? rejectReason : undefined,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "پردازش درخواست ناموفق بود.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          disabled={pending}
          onClick={() => run("APPROVE")}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary-bright disabled:opacity-50"
        >
          تأیید پرداخت
        </button>

        <input
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="دلیل رد (اختیاری)"
          className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <button
          disabled={pending}
          onClick={() => run("REJECT")}
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
        >
          رد
        </button>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
