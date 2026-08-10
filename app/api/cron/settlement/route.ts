import { NextResponse } from "next/server";
import { runAutoCloseSweep } from "@/lib/finance/commission";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 503 }
    );
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutoCloseSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Cron settlement error:", error);
    return NextResponse.json(
      { error: "خطا در اجرای تسویه." },
      { status: 500 }
    );
  }
}