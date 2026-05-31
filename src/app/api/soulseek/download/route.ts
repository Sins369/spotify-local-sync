import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getDb } from "@/lib/db";
import { startDownloadWorker } from "@/lib/download-worker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, file, spotify_track_id, file_size, format, bitrate } = body;

    if (!username || !file || !spotify_track_id) {
      return NextResponse.json(
        { error: "username, file, and spotify_track_id are required" },
        { status: 400 },
      );
    }

    const db = getDb();

    const spotifyTrack = db.prepare("SELECT id FROM spotify_tracks WHERE id = ?")
      .get(spotify_track_id);
    if (!spotifyTrack) {
      return NextResponse.json({ error: "Spotify track not found" }, { status: 404 });
    }

    const result = db.prepare(`
      INSERT INTO downloads (spotify_track_id, status, source_user, source_file, filename, file_size, format, bitrate)
      VALUES (?, 'queued', ?, ?, ?, ?, ?, ?)
    `).run(
      spotify_track_id,
      username,
      file,
      path.basename(file),
      file_size ?? null,
      format ?? null,
      bitrate ?? null,
    );

    startDownloadWorker();

    return NextResponse.json({
      download_id: result.lastInsertRowid,
      status: "queued",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue download" },
      { status: 500 },
    );
  }
}
