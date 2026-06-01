import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { startDownloadWorker } from "@/lib/download-worker";

export async function POST() {
  try {
    const db = getDb();

    const result = db
      .prepare(
        `UPDATE downloads
         SET status = 'queued', error = NULL
         WHERE status = 'failed'`
      )
      .run();

    if (result.changes > 0) {
      startDownloadWorker();
    }

    return NextResponse.json({ retried: result.changes });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to retry downloads",
      },
      { status: 500 },
    );
  }
}
