import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/spotify-auth";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET() {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID || getSetting("spotify_client_id");
    if (!clientId) {
      return NextResponse.json(
        { error: "Spotify client ID not configured. Set SPOTIFY_CLIENT_ID in .env.local" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";
    const redirectUri = getSetting("spotify_redirect_uri") || `${baseUrl}/api/spotify/callback`;

    const { url, codeVerifier } = await buildAuthUrl(clientId, redirectUri);

    setSetting("spotify_code_verifier", codeVerifier);

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build auth URL" },
      { status: 500 }
    );
  }
}
