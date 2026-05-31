import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const totalLocal = (
      db.prepare("SELECT COUNT(*) as count FROM local_tracks").get() as {
        count: number;
      }
    ).count;

    const matchedTracks = (
      db.prepare("SELECT COUNT(DISTINCT local_track_id) as count FROM matches").get() as {
        count: number;
      }
    ).count;

    const spotifyTracks = (
      db.prepare("SELECT COUNT(*) as count FROM spotify_tracks").get() as {
        count: number;
      }
    ).count;

    const duplicateGroups = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM duplicate_groups WHERE resolution IS NULL"
        )
        .get() as { count: number }
    ).count;

    const lastScan = (
      db
        .prepare(
          "SELECT MAX(scanned_at) as last_scan FROM local_tracks"
        )
        .get() as { last_scan: string | null }
    ).last_scan;

    return NextResponse.json({
      total_local_tracks: totalLocal,
      matched_tracks: matchedTracks,
      spotify_tracks: spotifyTracks,
      unmatched_tracks: totalLocal - matchedTracks,
      duplicate_groups: duplicateGroups,
      last_scan: lastScan,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
