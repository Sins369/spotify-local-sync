import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { match_id, confirmed } = body;

    if (match_id == null) {
      return NextResponse.json(
        { error: "match_id is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    if (confirmed) {
      db.prepare("UPDATE matches SET confirmed = 1 WHERE id = ?").run(match_id);
      return NextResponse.json({ success: true, action: "confirmed" });
    } else {
      db.prepare("DELETE FROM matches WHERE id = ?").run(match_id);
      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update match" },
      { status: 500 }
    );
  }
}
