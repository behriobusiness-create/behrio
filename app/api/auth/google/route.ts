import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildGoogleAuthUrl,
  generateOAuthState,
  getGoogleCallbackUrl,
  getGoogleClientId,
} from "@/lib/auth/google";

const OAUTH_STATE_COOKIE = "google_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

export async function GET(request: Request) {
  const clientId = getGoogleClientId();

  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    );
  }

  const requestUrl = new URL(request.url);
  const baseUrl = requestUrl.origin;
  const callbackUrl = getGoogleCallbackUrl(baseUrl);

  const state = generateOAuthState();

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(callbackUrl, state));
}
