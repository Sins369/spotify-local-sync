import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { refreshAccessToken } from "@/lib/spotify-auth";

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
    setSetting("spotify_token_expires_at", String(Date.now() + tokens.expires_in * 1000));
    return tokens.access_token;
  }

  return accessToken;
}

async function searchItunes(artist: string, title: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=5`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results as Array<{ previewUrl?: string; trackName?: string }>;
    if (results.length > 0 && results[0].previewUrl) {
      return results[0].previewUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const spotifyId = request.nextUrl.searchParams.get("id");
    if (!spotifyId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ preview_url: null, source: null });
    }

    const track = await res.json();

    if (track.preview_url) {
      return NextResponse.json({ preview_url: track.preview_url, source: "spotify" });
    }

    const itunesUrl = await searchItunes(
      track.artists?.[0]?.name ?? "",
      track.name ?? ""
    );

    if (itunesUrl) {
      return NextResponse.json({ preview_url: itunesUrl, source: "itunes" });
    }

    return NextResponse.json({ preview_url: null, source: null });
  } catch {
    return NextResponse.json({ preview_url: null, source: null });
  }
}
