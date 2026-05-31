import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const history = db
      .prepare(
        `SELECT * FROM backup_state
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .all();

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to get backup history",
      },
      { status: 500 }
    );
  }
}
