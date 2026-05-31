import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/spotify-auth";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(
        new URL("/settings?error=no_code", request.url)
      );
    }

    const error = request.nextUrl.searchParams.get("error");
    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID || getSetting("spotify_client_id");
    const codeVerifier = getSetting("spotify_code_verifier");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
    const redirectUri = getSetting("spotify_redirect_uri") || `${baseUrl}/api/spotify/callback`;

    if (!clientId || !codeVerifier) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_config", request.url)
      );
    }

    const tokens = await exchangeCodeForTokens(
      clientId,
      code,
      codeVerifier,
      redirectUri
    );

    setSetting("spotify_access_token", tokens.access_token);
    setSetting("spotify_refresh_token", tokens.refresh_token);
    setSetting(
      "spotify_token_expires_at",
      String(Date.now() + tokens.expires_in * 1000)
    );

    return NextResponse.redirect(
      new URL("/settings?success=connected", request.url)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
