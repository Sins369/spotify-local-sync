import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runBulkDownload, isBulkRunning } from "@/lib/bulk-downloader";

export async function POST(request: NextRequest) {
  try {
    if (isBulkRunning()) {
      return NextResponse.json({ error: "Bulk download already in progress" }, { status: 409 });
    }

    const body = await request.json();
    const qualityPref = body.qualityPref || "any";
    const batchSize = body.batchSize || 25;
    let trackIds: number[] = body.trackIds ?? [];

    const db = getDb();

    if (trackIds.length === 0) {
      const missing = db.prepare(`
        SELECT st.id FROM spotify_tracks st
        LEFT JOIN matches m ON st.id = m.spotify_track_id
        WHERE m.id IS NULL
        AND st.id NOT IN (
          SELECT spotify_track_id FROM downloads WHERE status IN ('complete', 'downloading', 'tagging', 'queued')
        )
        ORDER BY st.id ASC
      `).all() as Array<{ id: number }>;
      trackIds = missing.map((r) => r.id);
    }

    if (batchSize !== "all" && typeof batchSize === "number") {
      trackIds = trackIds.slice(0, batchSize);
    }

    if (trackIds.length === 0) {
      return NextResponse.json({ error: "No tracks to download" }, { status: 400 });
    }

    runBulkDownload(trackIds, qualityPref).catch(() => {});

    return NextResponse.json({ started: true, totalTracks: trackIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start bulk download" },
      { status: 500 },
    );
  }
}
