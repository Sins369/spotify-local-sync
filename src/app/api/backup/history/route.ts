import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const history = db
      .prepare(
        `SELECT id, files_synced, files_new, files_failed, status, duration_ms, created_at
         FROM backup_history
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .all();

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to get backup history",
      },
      { status: 500 },
    );
  }
}
