import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get("track_id");
  if (!trackId) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const db = getDb();
  const users = db
    .prepare("SELECT username FROM failed_users WHERE spotify_track_id = ?")
    .all(parseInt(trackId, 10)) as Array<{ username: string }>;

  return NextResponse.json(users.map((u) => u.username));
}
