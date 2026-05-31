import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { refreshAccessToken } from "@/lib/spotify-auth";
import { SpotifyClient } from "@/lib/spotify-client";

async function getValidAccessToken(): Promise<string> {
  const accessToken = getSetting("spotify_access_token");
  const expiresAt = getSetting("spotify_token_expires_at");
  const refreshToken = getSetting("spotify_refresh_token");
  const clientId = process.env.SPOTIFY_CLIENT_ID || getSetting("spotify_client_id");

  if (!accessToken || !refreshToken || !clientId) {
    throw new Error("Spotify not connected");
  }

  if (expiresAt && Date.now() > Number(expiresAt) - 5 * 60 * 1000) {
    const tokens = await refreshAccessToken(clientId, refreshToken);
    setSetting("spotify_access_token", tokens.access_token);
    setSetting("spotify_refresh_token", tokens.refresh_token);
    setSetting(
      "spotify_token_expires_at",
      String(Date.now() + tokens.expires_in * 1000)
    );
    return tokens.access_token;
  }

  return accessToken;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const uris: string[] = body.uris;

    if (!Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json(
        { error: "uris array is required" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken();
    const client = new SpotifyClient(accessToken);
    await client.likeTracks(uris);

    return NextResponse.json({ success: true, liked: uris.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to like tracks" },
      { status: 500 }
    );
  }
}
