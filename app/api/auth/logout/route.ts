import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashSessionToken(token);
    await prisma.authSession.deleteMany({
      where: { tokenHash },
    });
  }

  await clearSessionCookie();

  return NextResponse.redirect(new URL("/login", request.url), 303);
}
