import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "title";
    const sortDir = searchParams.get("sortDir") === "desc" ? "DESC" : "ASC";
    const format = searchParams.get("format") || "all";
    const matchStatus = searchParams.get("matchStatus") || "all";
    const source = searchParams.get("source") || "all";

    const allowedSortColumns: Record<string, string> = {
      title: "title",
      artist: "artist",
      album: "album",
      genre: "genre",
      format: "format",
      bitrate: "bitrate",
      duration: "duration_ms",
      year: "year",
      spotify_added_at: "spotify_added_at",
      file_path: "file_path",
      matched: "matched",
      id: "id",
    };
    const sortColumn = allowedSortColumns[sortBy] || "title";

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push("(title LIKE ? OR artist LIKE ? OR album LIKE ?)");
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (format !== "all") {
      conditions.push("format = ?");
      params.push(format);
    }

    if (matchStatus === "matched") {
      conditions.push("matched = 1");
    } else if (matchStatus === "unmatched") {
      conditions.push("matched = 0");
    }

    let baseQuery: string;

    if (source === "local") {
      baseQuery = `
        SELECT
          lt.id,
          lt.title,
          lt.artist,
          lt.album,
          lt.genre,
          lt.codec AS format,
          lt.bitrate,
          lt.duration_ms,
          lt.year,
          lt.path AS file_path,
          NULL AS spotify_added_at,
          CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS matched
        FROM local_tracks lt
        LEFT JOIN matches m ON m.local_track_id = lt.id
      `;
    } else if (source === "spotify") {
      baseQuery = `
        SELECT
          st.id,
          st.title,
          st.artist,
          st.album,
          NULL AS genre,
          NULL AS format,
          NULL AS bitrate,
          st.duration_ms,
          st.year,
          NULL AS file_path,
          st.synced_at AS spotify_added_at,
          CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS matched
        FROM spotify_tracks st
        LEFT JOIN matches m ON m.spotify_track_id = st.id
      `;
    } else {
      // "both" or "all": combine local and spotify tracks, avoiding duplicates for matched pairs
      baseQuery = `
        SELECT
          lt.id,
          lt.title,
          lt.artist,
          lt.album,
          lt.genre,
          lt.codec AS format,
          lt.bitrate,
          lt.duration_ms,
          lt.year,
          lt.path AS file_path,
          NULL AS spotify_added_at,
          CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS matched
        FROM local_tracks lt
        LEFT JOIN matches m ON m.local_track_id = lt.id

        UNION ALL

        SELECT
          st.id,
          st.title,
          st.artist,
          st.album,
          NULL AS genre,
          NULL AS format,
          NULL AS bitrate,
          st.duration_ms,
          st.year,
          NULL AS file_path,
          st.synced_at AS spotify_added_at,
          CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS matched
        FROM spotify_tracks st
        LEFT JOIN matches m ON m.spotify_track_id = st.id
        WHERE st.id NOT IN (
          SELECT spotify_track_id FROM matches WHERE spotify_track_id IS NOT NULL
        )
      `;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const wrappedQuery = `SELECT * FROM (${baseQuery}) combined ${whereClause}`;

    const countSql = `SELECT COUNT(*) AS count FROM (${baseQuery}) combined ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as { count: number };

    const offset = (page - 1) * limit;
    const effectiveSortColumn = sortColumn === "spotify_added_at" ? "id" : sortColumn;
    const effectiveSortDir = sortColumn === "spotify_added_at" ? (sortDir === "ASC" ? "ASC" : "DESC") : sortDir;
    const dataSql = `${wrappedQuery} ORDER BY ${effectiveSortColumn} ${effectiveSortDir} NULLS LAST LIMIT ? OFFSET ?`;
    const tracks = db.prepare(dataSql).all(...params, limit, offset);

    return NextResponse.json({
      tracks,
      total: countResult.count,
      page,
      limit,
      totalPages: Math.ceil(countResult.count / limit),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to get library",
      },
      { status: 500 },
    );
  }
}
