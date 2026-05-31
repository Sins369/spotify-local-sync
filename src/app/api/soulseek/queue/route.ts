import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const downloads = db
      .prepare(
        `SELECT d.*, st.title, st.artist, st.album, st.spotify_id
         FROM downloads d
         JOIN spotify_tracks st ON d.spotify_track_id = st.id
         ORDER BY d.created_at DESC
         LIMIT 100`
      )
      .all();

    return NextResponse.json(downloads);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get queue" },
      { status: 500 }
    );
  }
}
