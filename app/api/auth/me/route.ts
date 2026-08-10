import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, authenticated: false, user: null },
      { status: 401 },
    );
  }

  const fullUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      creatorProfile: {
        select: { id: true, displayName: true, instagramHandle: true },
      },
      businessProfile: {
        select: { id: true, companyName: true, website: true },
      },
    },
  });

  if (!fullUser) {
    return NextResponse.json(
      { ok: false, authenticated: false, user: null },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: fullUser,
  });
}
