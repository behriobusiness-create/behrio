import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getBusinessWallet } from "@/lib/wallet";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const wallet = await getBusinessWallet(prisma, user.id);

    return NextResponse.json({
      ok: true,
      wallet: {
        funded: wallet.funded.toNumber(),
        reserved: wallet.reserved.toNumber(),
        spent: wallet.spent.toNumber(),
        available: wallet.available.toNumber(),
      },
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    return NextResponse.json(
      { error: "خطا در دریافت کیف پول." },
      { status: 500 }
    );
  }
}
