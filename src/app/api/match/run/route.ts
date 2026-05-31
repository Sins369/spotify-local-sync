import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { matchLocalToSpotify } from "@/lib/matcher";
import { getSetting, setSetting } from "@/lib/settings";
import { refreshAccessToken } from "@/lib/spotify-auth";
import { SpotifyClient } from "@/lib/spotify-client";

async function getValidAccessToken(): Promise<string> {
  const accessToken = getSetting("spotify_access_token");
  const expiresAt = getSetting("spotify_token_expires_at");
  const refreshToken = getSetting("spotify_refresh_token");
  const clientId = getSetting("spotify_client_id");

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

export async function POST() {
  try {
    const db = getDb();
    const accessToken = await getValidAccessToken();
    const spotifyClient = new SpotifyClient(accessToken);

    // Get local tracks that have no match yet
    const unmatchedTracks = db
      .prepare(
        `SELECT lt.* FROM local_tracks lt
         LEFT JOIN matches m ON lt.id = m.local_track_id
         WHERE m.id IS NULL AND lt.title IS NOT NULL AND lt.artist IS NOT NULL`
      )
      .all() as Array<{
      id: number;
      title: string;
      artist: string;
      duration_ms: number | null;
      isrc: string | null;
    }>;

    const insertMatch = db.prepare(`
      INSERT INTO matches (local_track_id, spotify_track_id, method, confidence, confirmed)
      VALUES (@local_track_id, @spotify_track_id, @method, @confidence, @confirmed)
    `);

    // Find spotify_track_id from spotify_id
    const findSpotifyTrack = db.prepare(
      "SELECT id FROM spotify_tracks WHERE spotify_id = ?"
    );

    let matched = 0;
    let noMatch = 0;

    for (const track of unmatchedTracks) {
      const searchClient = {
        async searchByISRC(isrc: string) {
          const results = await spotifyClient.searchByIsrc(isrc);
          if (results.length === 0) return null;
          const r = results[0];
          return {
            id: r.id,
            title: r.name,
            artist: r.artists.map((a) => a.name).join(", "),
            duration_ms: r.duration_ms,
          };
        },
        async searchByQuery(title: string, artist: string) {
          const results = await spotifyClient.searchTrack(
            `${title} ${artist}`
          );
          return results.map((r) => ({
            id: r.id,
            title: r.name,
            artist: r.artists.map((a) => a.name).join(", "),
            duration_ms: r.duration_ms,
          }));
        },
      };

      const result = await matchLocalToSpotify(
        {
          title: track.title,
          artist: track.artist,
          duration_ms: track.duration_ms ?? 0,
          isrc: track.isrc ?? undefined,
        },
        searchClient
      );

      if (result) {
        // Look up the spotify_tracks table id from spotify_id
        const spotifyTrackRow = findSpotifyTrack.get(result.spotifyId) as
          | { id: number }
          | undefined;

        // If the Spotify track isn't in our DB, skip (it should be synced first)
        if (!spotifyTrackRow) {
          noMatch++;
          continue;
        }

        insertMatch.run({
          local_track_id: track.id,
          spotify_track_id: spotifyTrackRow.id,
          method: track.isrc ? "isrc" : "search",
          confidence: result.score,
          confirmed: result.confidence === "confirmed" ? 1 : 0,
        });
        matched++;
      } else {
        noMatch++;
      }
    }

    return NextResponse.json({
      total: unmatchedTracks.length,
      matched,
      no_match: noMatch,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}
