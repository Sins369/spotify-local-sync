import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getDb } from "@/lib/db";
import { downloadFromSoulseek } from "@/lib/soulseek-client";
import { writeTags } from "@/lib/metadata-writer";
import { renderPath } from "@/lib/file-organizer";
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, file, spotify_track_id } = body;

    if (!username || !file || !spotify_track_id) {
      return NextResponse.json(
        { error: "username, file, and spotify_track_id are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Get spotify track metadata for tagging
    const spotifyTrack = db
      .prepare("SELECT * FROM spotify_tracks WHERE id = ?")
      .get(spotify_track_id) as
      | {
          id: number;
          spotify_id: string;
          title: string | null;
          artist: string | null;
          album: string | null;
          album_artist: string | null;
          track_number: number | null;
          disc_number: number | null;
          year: number | null;
          duration_ms: number | null;
          isrc: string | null;
        }
      | undefined;

    if (!spotifyTrack) {
      return NextResponse.json(
        { error: "Spotify track not found" },
        { status: 404 }
      );
    }

    // Create download record
    const insertDownload = db.prepare(`
      INSERT INTO downloads (spotify_track_id, status, source_user, filename, started_at)
      VALUES (?, 'downloading', ?, ?, datetime('now'))
    `);

    const downloadResult = insertDownload.run(
      spotify_track_id,
      username,
      path.basename(file)
    );
    const downloadId = downloadResult.lastInsertRowid;

    // Build the destination path
    const musicPath = getSetting("download_path") || getSetting("backup_dest_path") || getSetting("music_source_path") || process.cwd();
    const template =
      getSetting("file_template") ||
      getSetting("path_template") ||
      "{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}";

    const ext = path.extname(file).slice(1).toLowerCase() || "mp3";

    const destRelative = renderPath(template, {
      album_artist: spotifyTrack.album_artist,
      artist: spotifyTrack.artist,
      album: spotifyTrack.album,
      title: spotifyTrack.title,
      track_no: spotifyTrack.track_number,
      disc_no: spotifyTrack.disc_number,
      year: spotifyTrack.year,
      genre: null,
      ext,
    });

    const destPath = path.join(musicPath, destRelative);

    try {
      // Download the file
      await downloadFromSoulseek(username, file, destPath);

      // Auto-tag with Spotify metadata
      try {
        await writeTags(destPath, {
          title: spotifyTrack.title || undefined,
          artist: spotifyTrack.artist || undefined,
          album: spotifyTrack.album || undefined,
        });
      } catch {
        // Tagging failure is non-fatal
      }

      // Update download record as complete
      db.prepare(
        `UPDATE downloads SET status = 'complete', download_path = ?, completed_at = datetime('now')
         WHERE id = ?`
      ).run(destPath, downloadId);

      return NextResponse.json({
        success: true,
        download_id: downloadId,
        path: destPath,
      });
    } catch (downloadError) {
      // Update download record as failed
      db.prepare(
        `UPDATE downloads SET status = 'failed', error = ?, completed_at = datetime('now')
         WHERE id = ?`
      ).run(
        downloadError instanceof Error
          ? downloadError.message
          : "Download failed",
        downloadId
      );

      return NextResponse.json(
        {
          error:
            downloadError instanceof Error
              ? downloadError.message
              : "Download failed",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}
