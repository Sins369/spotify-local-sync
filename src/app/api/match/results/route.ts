import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const filter = request.nextUrl.searchParams.get("filter");

    let results;

    switch (filter) {
      case "confirmed":
        results = db
          .prepare(
            `SELECT m.*, lt.title as local_title, lt.artist as local_artist, lt.path,
                    st.title as spotify_title, st.artist as spotify_artist, st.spotify_id
             FROM matches m
             JOIN local_tracks lt ON m.local_track_id = lt.id
             JOIN spotify_tracks st ON m.spotify_track_id = st.id
             WHERE m.confirmed = 1
             ORDER BY m.created_at DESC`
          )
          .all();
        break;

      case "probable":
        results = db
          .prepare(
            `SELECT m.*, lt.title as local_title, lt.artist as local_artist, lt.path,
                    st.title as spotify_title, st.artist as spotify_artist, st.spotify_id
             FROM matches m
             JOIN local_tracks lt ON m.local_track_id = lt.id
             JOIN spotify_tracks st ON m.spotify_track_id = st.id
             WHERE m.confirmed = 0 AND m.confidence >= 0.7
             ORDER BY m.confidence DESC`
          )
          .all();
        break;

      case "missing_locally":
        // Spotify tracks with no local match
        results = db
          .prepare(
            `SELECT st.*
             FROM spotify_tracks st
             LEFT JOIN matches m ON st.id = m.spotify_track_id
             WHERE m.id IS NULL
             ORDER BY st.title`
          )
          .all();
        break;

      case "missing_on_spotify":
        // Local tracks with no Spotify match
        results = db
          .prepare(
            `SELECT lt.*
             FROM local_tracks lt
             LEFT JOIN matches m ON lt.id = m.local_track_id
             WHERE m.id IS NULL
             ORDER BY lt.title`
          )
          .all();
        break;

      default:
        // All matches
        results = db
          .prepare(
            `SELECT m.*, lt.title as local_title, lt.artist as local_artist, lt.path,
                    st.title as spotify_title, st.artist as spotify_artist, st.spotify_id
             FROM matches m
             JOIN local_tracks lt ON m.local_track_id = lt.id
             JOIN spotify_tracks st ON m.spotify_track_id = st.id
             ORDER BY m.created_at DESC`
          )
          .all();
        break;
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get results" },
      { status: 500 }
    );
  }
}
