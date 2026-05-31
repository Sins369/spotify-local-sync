import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "title";
    const sortDir = searchParams.get("sortDir") === "desc" ? "DESC" : "ASC";

    const allowedSortColumns: Record<string, string> = {
      title: "title",
      artist: "artist",
      album: "album",
      added_at: "synced_at",
    };
    const sortColumn = allowedSortColumns[sortBy] || "title";

    let whereClause = "";
    const params: string[] = [];

    if (search) {
      whereClause = "WHERE (title LIKE ? OR artist LIKE ? OR album LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const countResult = db
      .prepare(`SELECT COUNT(*) as count FROM spotify_tracks ${whereClause}`)
      .get(...params) as { count: number };

    const offset = (page - 1) * limit;
    const tracks = db
      .prepare(
        `SELECT id, spotify_id, title, artist, album, duration_ms, synced_at as added_at
         FROM spotify_tracks ${whereClause}
         ORDER BY ${sortColumn} ${sortDir} NULLS LAST
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      tracks,
      total: countResult.count,
      page,
      limit,
      totalPages: Math.ceil(countResult.count / limit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get Spotify tracks" },
      { status: 500 }
    );
  }
}
