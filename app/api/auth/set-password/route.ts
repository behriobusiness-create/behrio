import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hashPassword, passwordStrengthIssues } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json(
        { error: "رمز عبور الزامی است." },
        { status: 400 }
      );
    }

    const issue = passwordStrengthIssues(password);
    if (issue) {
      return NextResponse.json({ error: issue }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true, message: "رمز عبور ذخیره شد." });
  } catch (error) {
    console.error("Set password failed:", error);
    return NextResponse.json(
      { error: "ذخیره رمز عبور ناموفق بود." },
      { status: 500 }
    );
  }
}
