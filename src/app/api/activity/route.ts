import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const entries = db
      .prepare(
        `SELECT id, action, detail, color, created_at
         FROM activity_log
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all();

    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to get activity log",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const { action, detail, color } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    db.prepare(
      "INSERT INTO activity_log (action, detail, color) VALUES (?, ?, ?)"
    ).run(action, detail ?? null, color ?? "primary");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to log activity" },
      { status: 500 },
    );
  }
}
