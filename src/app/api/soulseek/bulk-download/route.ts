import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { startDownloadWorker } from "@/lib/download-worker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const batchSize = body.batchSize || 25;
    let trackIds: number[] = body.trackIds ?? [];

    const db = getDb();

    if (trackIds.length === 0) {
      const missing = db.prepare(`
        SELECT st.id FROM spotify_tracks st
        LEFT JOIN matches m ON st.id = m.spotify_track_id
        WHERE m.id IS NULL
        AND st.id NOT IN (SELECT spotify_track_id FROM downloads)
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

    const insert = db.prepare(
      "INSERT OR IGNORE INTO downloads (spotify_track_id, status) VALUES (?, 'pending_search')"
    );
    let queued = 0;
    db.transaction(() => {
      for (const id of trackIds) {
        const r = insert.run(id);
        if (r.changes > 0) queued++;
      }
    })();

    startDownloadWorker();

    return NextResponse.json({ started: true, queued, totalTracks: trackIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start bulk download" },
      { status: 500 },
    );
  }
}
