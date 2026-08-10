import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  getGoogleCallbackUrl,
} from "@/lib/auth/google";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";

const OAUTH_STATE_COOKIE = "google_oauth_state";

function redirectToLogin(baseUrl: string, error: string): NextResponse {
  return NextResponse.redirect(
    `${baseUrl}/login?error=${encodeURIComponent(error)}`
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const baseUrl = requestUrl.origin;

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (oauthError) {
    return redirectToLogin(baseUrl, "google_access_denied");
  }

  if (!code || !state || state !== expectedState) {
    return redirectToLogin(baseUrl, "google_state_mismatch");
  }

  const callbackUrl = getGoogleCallbackUrl(baseUrl);

  try {
    const tokens = await exchangeGoogleCode(code, callbackUrl);

    const profile = await fetchGoogleProfile(tokens.access_token);

    if (!profile.email) {
      return redirectToLogin(baseUrl, "google_no_email");
    }

    const email = profile.email.toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
          name: profile.name || null,
          image: profile.picture || null,
          role: null,
        },
        include: { accounts: true },
      });
    }

    const existingAccount = user.accounts.find(
      (account) =>
        account.provider === "google" &&
        account.providerAccountId === profile.sub
    );

    if (!existingAccount) {
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: profile.sub,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          id_token: tokens.id_token ?? null,
          expires_at: tokens.expires_in
            ? Math.floor(Date.now() / 1000) + tokens.expires_in
            : null,
          token_type: tokens.token_type,
          scope: tokens.scope ?? null,
        },
      });
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiry();

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await setSessionCookie(sessionToken, expiresAt);

    cookieStore.delete(OAUTH_STATE_COOKIE);

    let destination = "/onboarding";
    if (user.role === "ADMIN") destination = "/admin";
    else if (user.role === "BUSINESS") destination = "/business";
    else if (user.role === "CREATOR") destination = "/creator";

    return NextResponse.redirect(`${baseUrl}${destination}`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return redirectToLogin(baseUrl, "google_auth_failed");
  }
}
