import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildMetadataDiffs } from "@/lib/metadata-writer";

export async function GET() {
  try {
    const db = getDb();

    // Get all confirmed matches with local and spotify track data
    const confirmedMatches = db
      .prepare(
        `SELECT m.id as match_id,
                lt.id as local_id, lt.path as local_path, lt.title as local_title,
                lt.artist as local_artist, lt.album as local_album, lt.genre as local_genre,
                lt.has_artwork as local_has_artwork,
                st.id as spotify_id, st.title as spotify_title,
                st.artist as spotify_artist, st.album as spotify_album,
                st.album_art_url as spotify_art_url, st.genre as spotify_genre
         FROM matches m
         JOIN local_tracks lt ON m.local_track_id = lt.id
         JOIN spotify_tracks st ON m.spotify_track_id = st.id
         WHERE m.confirmed = 1`
      )
      .all() as Array<{
      match_id: number;
      local_id: number;
      local_path: string;
      local_title: string | null;
      local_artist: string | null;
      local_album: string | null;
      local_genre: string | null;
      local_has_artwork: number | null;
      spotify_id: number;
      spotify_title: string | null;
      spotify_artist: string | null;
      spotify_album: string | null;
      spotify_art_url: string | null;
      spotify_genre: string | null;
    }>;

    const allDiffs = [];

    for (const match of confirmedMatches) {
      const diffs = buildMetadataDiffs(
        {
          id: match.local_id,
          path: match.local_path,
          title: match.local_title,
          artist: match.local_artist,
          album: match.local_album,
          has_artwork: match.local_has_artwork ?? 0,
        },
        {
          id: match.spotify_id,
          title: match.spotify_title,
          artist: match.spotify_artist,
          album: match.spotify_album,
          album_art_url: match.spotify_art_url,
        }
      );

      if (match.spotify_genre && (!match.local_genre || match.local_genre.toLowerCase() !== match.spotify_genre.toLowerCase())) {
        diffs.push({
          local_track_id: match.local_id,
          spotify_track_id: match.spotify_id,
          local_path: match.local_path,
          field: "genre",
          local_value: match.local_genre,
          spotify_value: match.spotify_genre,
        });
      }

      allDiffs.push(...diffs);
    }

    return NextResponse.json(allDiffs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get diffs" },
      { status: 500 }
    );
  }
}
