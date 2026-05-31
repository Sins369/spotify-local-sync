import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
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

  // Refresh if token expires within 5 minutes
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

export async function POST() {
  try {
    const accessToken = await getValidAccessToken();
    const client = new SpotifyClient(accessToken);
    const savedTracks = await client.getAllSavedTracks();
    const db = getDb();

    const upsertStmt = db.prepare(`
      INSERT INTO spotify_tracks (
        spotify_id, title, artist, album, album_artist,
        track_number, disc_number, year, duration_ms, isrc,
        popularity, synced_at
      ) VALUES (
        @spotify_id, @title, @artist, @album, @album_artist,
        @track_number, @disc_number, @year, @duration_ms, @isrc,
        @popularity, datetime('now')
      )
      ON CONFLICT(spotify_id) DO UPDATE SET
        title = @title,
        artist = @artist,
        album = @album,
        album_artist = @album_artist,
        track_number = @track_number,
        disc_number = @disc_number,
        year = @year,
        duration_ms = @duration_ms,
        isrc = @isrc,
        popularity = @popularity,
        synced_at = datetime('now')
    `);

    let synced = 0;
    let skippedLocal = 0;

    const upsertAll = db.transaction(() => {
      for (const item of savedTracks) {
        const track = item.track;
        if (track.uri && track.uri.startsWith("spotify:local:")) {
          skippedLocal++;
          continue;
        }

        upsertStmt.run({
          spotify_id: track.id,
          title: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          album: track.album.name,
          album_artist: track.artists[0]?.name ?? null,
          track_number: null,
          disc_number: null,
          year: null,
          duration_ms: track.duration_ms,
          isrc: track.external_ids?.isrc ?? null,
          popularity: null,
        });
        synced++;
      }
    });

    upsertAll();

    return NextResponse.json({ synced, skipped_local: skippedLocal });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
