import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getActiveProgress } from "@/lib/soulseek-download";

export async function GET() {
  try {
    const db = getDb();
    const progress = getActiveProgress();

    const downloads = db
      .prepare(
        `SELECT d.*, st.title, st.artist, st.album, st.spotify_id
         FROM downloads d
         JOIN spotify_tracks st ON d.spotify_track_id = st.id
         ORDER BY
           CASE d.status
             WHEN 'downloading' THEN 0
             WHEN 'tagging' THEN 1
             WHEN 'pending_search' THEN 2
             WHEN 'queued' THEN 3
             WHEN 'failed' THEN 4
             WHEN 'complete' THEN 5
             ELSE 6
           END,
           d.created_at DESC
         LIMIT 200`
      )
      .all() as Array<Record<string, unknown>>;

    for (const dl of downloads) {
      const p = progress.get(dl.id as number);
      if (p) {
        dl.bytes_received = p.bytesReceived;
        dl.percent = p.percent;
        dl.speed = p.speed;
      }
    }

    let queuePosition = 1;
    for (const dl of downloads) {
      if (dl.status === "queued") {
        dl.queue_position = queuePosition++;
      }
    }

    const stats = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'downloading' OR status = 'tagging' THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN status = 'pending_search' THEN 1 ELSE 0 END) as searching,
           SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
           SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           COUNT(*) as total
         FROM downloads`
      )
      .get() as { active: number; queued: number; completed: number; failed: number; total: number };

    return NextResponse.json({ downloads, stats });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get queue" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const { action, id } = await request.json();

    if (action === "clear_completed") {
      const result = db.prepare("DELETE FROM downloads WHERE status = 'complete'").run();
      return NextResponse.json({ deleted: result.changes });
    }

    if (action === "clear_failed") {
      const result = db.prepare("DELETE FROM downloads WHERE status = 'failed'").run();
      return NextResponse.json({ deleted: result.changes });
    }

    if (action === "clear_all") {
      const result = db.prepare("DELETE FROM downloads WHERE status IN ('complete', 'failed')").run();
      return NextResponse.json({ deleted: result.changes });
    }

    if (action === "remove" && id) {
      db.prepare("DELETE FROM downloads WHERE id = ? AND status IN ('complete', 'failed')").run(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
