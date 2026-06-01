import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    const db = getDb();

    const result = db
      .prepare(
        `UPDATE downloads
         SET status = 'failed', error = 'Cancelled by user'
         WHERE status = 'queued'`
      )
      .run();

    return NextResponse.json({ cancelled: result.changes });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to clear queue",
      },
      { status: 500 },
    );
  }
}
