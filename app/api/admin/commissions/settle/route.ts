import { getCurrentUser } from "@/lib/auth/current-user";
import { NextResponse } from "next/server";
import { runAutoCloseSweep } from "@/lib/finance/commission";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز." },
        { status: 403 }
      );
    }

    const result = await runAutoCloseSweep();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Admin settle error:", error);
    return NextResponse.json(
      { error: "خطا در اجرای تسویه." },
      { status: 500 }
    );
  }
}
