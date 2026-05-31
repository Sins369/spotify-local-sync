import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cancelDownload } from "@/lib/soulseek-download";

export async function POST(request: NextRequest) {
  try {
    const { download_id } = await request.json();
    if (!download_id) {
      return NextResponse.json({ error: "download_id required" }, { status: 400 });
    }

    const db = getDb();
    const dl = db.prepare("SELECT id, status FROM downloads WHERE id = ?").get(download_id) as
      | { id: number; status: string }
      | undefined;

    if (!dl) {
      return NextResponse.json({ error: "Download not found" }, { status: 404 });
    }

    if (dl.status === "downloading") {
      cancelDownload(download_id);
    }

    if (dl.status === "queued" || dl.status === "downloading") {
      db.prepare(
        "UPDATE downloads SET status = 'failed', error = 'Cancelled by user', completed_at = datetime('now') WHERE id = ?"
      ).run(download_id);
      return NextResponse.json({ success: true, cancelled: true });
    }

    return NextResponse.json({ success: false, error: "Download cannot be cancelled in current state" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cancel failed" },
      { status: 500 },
    );
  }
}
