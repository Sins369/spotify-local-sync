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
        popularity, album_art_url, genre, synced_at
      ) VALUES (
        @spotify_id, @title, @artist, @album, @album_artist,
        @track_number, @disc_number, @year, @duration_ms, @isrc,
        @popularity, @album_art_url, @genre, datetime('now')
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
        album_art_url = @album_art_url,
        genre = COALESCE(@genre, genre),
        synced_at = datetime('now')
    `);

    let synced = 0;
    let skippedLocal = 0;

    // Collect unique artist IDs for genre lookup
    const artistIds = new Set<string>();
    const trackArtistMap = new Map<string, string>();
    for (const item of savedTracks) {
      const track = item.track;
      if (track.uri && track.uri.startsWith("spotify:local:")) continue;
      const primaryArtist = track.artists[0];
      if (primaryArtist?.id) {
        artistIds.add(primaryArtist.id);
        trackArtistMap.set(track.id, primaryArtist.id);
      }
    }

    // Batch-fetch artist genres from Spotify
    const artistGenres = await client.getArtistGenres([...artistIds]);

    const GENRE_MAP: Record<string, string> = {
      "drum and bass": "Drum & Bass",
      "dnb": "Drum & Bass",
      "r&b": "R&B",
      "uk garage": "UK Garage",
      "lo-fi beats": "Lo-Fi Beats",
      "hip hop": "Hip Hop",
      "trip hop": "Trip Hop",
      "k-pop": "K-Pop",
      "j-pop": "J-Pop",
      "edm": "EDM",
      "uk drill": "UK Drill",
      "diy": "DIY",
    };

    function formatGenre(raw: string): string {
      const lower = raw.toLowerCase();
      if (GENRE_MAP[lower]) return GENRE_MAP[lower];
      return raw.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const upsertAll = db.transaction(() => {
      for (const item of savedTracks) {
        const track = item.track;
        if (track.uri && track.uri.startsWith("spotify:local:")) {
          skippedLocal++;
          continue;
        }

        const artUrl = track.album.images?.[0]?.url ?? null;
        const primaryArtistId = trackArtistMap.get(track.id);
        const genres = primaryArtistId ? artistGenres.get(primaryArtistId) : null;
        const genreStr = genres && genres.length > 0 ? formatGenre(genres[0]) : null;

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
          album_art_url: artUrl,
          genre: genreStr,
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
