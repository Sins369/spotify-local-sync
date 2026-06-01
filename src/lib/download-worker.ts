import { getDb } from "./db";
import { getSetting } from "./settings";
import { connectSoulseek, isConnected, searchSoulseek } from "./soulseek-client";
import { streamDownload } from "./soulseek-download";
import { writeTags } from "./metadata-writer";
import { extractMetadata } from "./scanner";
import path from "path";
import fs from "fs";

const MAX_AUTO_RETRIES = 6;

const globalForWorker = globalThis as unknown as { __downloadWorkerRunning: boolean };

export function startDownloadWorker(): void {
  if (globalForWorker.__downloadWorkerRunning) return;
  globalForWorker.__downloadWorkerRunning = true;
  runLoop();
}

async function runLoop(): Promise<void> {
  while (globalForWorker.__downloadWorkerRunning) {
    try {
      await processQueue();
    } catch {
      // Worker error — continue loop
    }
    await sleep(3000);
  }
}

async function processQueue(): Promise<void> {
  const db = getDb();

  const maxConcurrent = parseInt(getSetting("max_concurrent_downloads") || "1", 10);
  const activeCount = (db.prepare("SELECT COUNT(*) as c FROM downloads WHERE status = 'downloading'").get() as { c: number }).c;

  if (activeCount >= maxConcurrent) return;

  const slotsAvailable = maxConcurrent - activeCount;
  const queued = db.prepare(
    "SELECT * FROM downloads WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?"
  ).all(slotsAvailable) as Array<{
    id: number;
    spotify_track_id: number;
    source_user: string;
    source_file: string;
    filename: string;
    file_size: number | null;
    format: string | null;
    bitrate: number | null;
  }>;

  if (queued.length === 0) return;

  if (!isConnected()) {
    const username = getSetting("soulseek_username");
    const password = getSetting("soulseek_password");
    if (!username || !password) return;
    const shareLibrary = getSetting("soulseek_share_library") === "true";
    const musicPath = getSetting("music_source_path");
    const sharedFolders = shareLibrary && musicPath ? [musicPath] : [];
    try {
      await Promise.race([
        connectSoulseek(username, password, sharedFolders),
        sleep(10000).then(() => { throw new Error("Connection timeout"); }),
      ]);
    } catch {
      return;
    }
  }

  for (const download of queued) {
    await processDownload(download);
  }
}

async function processDownload(download: {
  id: number;
  spotify_track_id: number;
  source_user: string;
  source_file: string;
  filename: string;
  file_size: number | null;
  format: string | null;
  bitrate: number | null;
}): Promise<void> {
  const db = getDb();

  db.prepare("UPDATE downloads SET status = 'downloading', started_at = datetime('now') WHERE id = ?")
    .run(download.id);

  const spotifyTrack = db.prepare("SELECT * FROM spotify_tracks WHERE id = ?")
    .get(download.spotify_track_id) as {
      title: string | null;
      artist: string | null;
      album: string | null;
      album_artist: string | null;
      track_number: number | null;
      disc_number: number | null;
      year: number | null;
    } | undefined;

  if (!spotifyTrack) {
    db.prepare("UPDATE downloads SET status = 'failed', error = 'Spotify track not found', completed_at = datetime('now') WHERE id = ?")
      .run(download.id);
    return;
  }

  const musicPath = getSetting("download_path") || getSetting("backup_dest_path") || getSetting("music_source_path") || process.cwd();
  const filename = download.filename || path.basename(download.source_file);
  const destPath = path.join(musicPath, filename);

  try {
    await streamDownload(
      download.id,
      download.source_user,
      download.source_file,
      destPath,
      download.file_size ?? 0,
    );

    db.prepare("UPDATE downloads SET status = 'tagging' WHERE id = ?").run(download.id);
    try {
      await writeTags(destPath, {
        title: spotifyTrack.title || undefined,
        artist: spotifyTrack.artist || undefined,
        album: spotifyTrack.album || undefined,
      });
    } catch {
      // Tagging failure is non-fatal
    }

    db.prepare(
      "UPDATE downloads SET status = 'complete', download_path = ?, bytes_received = file_size, completed_at = datetime('now') WHERE id = ?"
    ).run(destPath, download.id);

    // Index the downloaded file in local_tracks and auto-match to the Spotify track
    try {
      const meta = await extractMetadata(destPath);
      const stat = fs.statSync(destPath);
      db.prepare(`
        INSERT INTO local_tracks (path, filename, title, artist, album, album_artist,
          track_number, disc_number, year, genre, duration_ms, bitrate, sample_rate,
          codec, isrc, size_bytes, mtime_ms, has_artwork, scanned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(path) DO UPDATE SET
          title = excluded.title, artist = excluded.artist, album = excluded.album,
          size_bytes = excluded.size_bytes, mtime_ms = excluded.mtime_ms,
          has_artwork = excluded.has_artwork, scanned_at = datetime('now')
      `).run(
        meta.path, path.basename(destPath), meta.title, meta.artist, meta.album,
        meta.album_artist, meta.track_no, meta.disc_no, meta.year, meta.genre,
        meta.duration_ms, meta.bitrate, meta.sample_rate, meta.format, meta.isrc,
        stat.size, Math.floor(stat.mtimeMs), meta.has_artwork ? 1 : 0
      );
      const localTrack = db.prepare("SELECT id FROM local_tracks WHERE path = ?").get(destPath) as { id: number } | undefined;
      if (localTrack) {
        db.prepare(
          "INSERT OR IGNORE INTO matches (local_track_id, spotify_track_id, method, confidence, confirmed) VALUES (?, ?, 'download', 1.0, 1)"
        ).run(localTrack.id, download.spotify_track_id);
      }
    } catch {}


  } catch (err) {
    const error = err instanceof Error ? err.message : "Download failed";
    db.prepare(
      "INSERT OR IGNORE INTO failed_users (spotify_track_id, username) VALUES (?, ?)"
    ).run(download.spotify_track_id, download.source_user);

    const isRetryable = error.includes("User not exist") || error.includes("not responding") || error.includes("timed out") || error.includes("stalled");
    const retryCount = (db.prepare(
      "SELECT COUNT(*) as c FROM failed_users WHERE spotify_track_id = ?"
    ).get(download.spotify_track_id) as { c: number }).c;

    if (isRetryable && retryCount < MAX_AUTO_RETRIES) {
      // Reconnect if peer connection is gone
      if (error.includes("User not exist")) {
        try {
          const { disconnectSoulseek } = await import("./soulseek-client");
          await disconnectSoulseek();
          const username = getSetting("soulseek_username");
          const password = getSetting("soulseek_password");
          const shareLibrary = getSetting("soulseek_share_library") === "true";
          const musicPath2 = getSetting("music_source_path");
          const sharedFolders = shareLibrary && musicPath2 ? [musicPath2] : [];
          if (username && password) {
            await connectSoulseek(username, password, sharedFolders);
          }
        } catch {}
      }

      // Wait longer between retries — peers come online at different times
      const delayMs = Math.min(retryCount * 10000, 30000);
      if (delayMs > 0) await sleep(delayMs);

      const altSource = await findAlternateSource(download.spotify_track_id, download.source_file);
      if (altSource) {
        db.prepare(
          "UPDATE downloads SET source_user = ?, source_file = ?, filename = ?, file_size = ?, format = ?, bitrate = ?, status = 'queued', error = NULL, started_at = NULL WHERE id = ?"
        ).run(
          altSource.username, altSource.file, path.basename(altSource.file),
          altSource.size, altSource.format, altSource.bitrate, download.id
        );
        return;
      }
    }

    const retriesLeft = MAX_AUTO_RETRIES - retryCount;
    const finalError = retriesLeft > 0
      ? `${error} (${retryCount} sources tried, no more available)`
      : `${error} (all ${MAX_AUTO_RETRIES} sources exhausted)`;
    db.prepare(
      "UPDATE downloads SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(finalError, download.id);
  }
}

async function ensureConnected(): Promise<boolean> {
  if (isConnected()) return true;
  const username = getSetting("soulseek_username");
  const password = getSetting("soulseek_password");
  if (!username || !password) return false;
  const shareLibrary = getSetting("soulseek_share_library") === "true";
  const musicPath = getSetting("music_source_path");
  const sharedFolders = shareLibrary && musicPath ? [musicPath] : [];
  try {
    await Promise.race([
      connectSoulseek(username, password, sharedFolders),
      sleep(10000).then(() => { throw new Error("Connection timeout"); }),
    ]);
    return true;
  } catch { return false; }
}

async function findAlternateSource(
  spotifyTrackId: number,
  currentFile: string,
): Promise<{ username: string; file: string; size: number; format: string; bitrate: number | null } | null> {
  const db = getDb();

  const failedUserRows = db.prepare(
    "SELECT username FROM failed_users WHERE spotify_track_id = ?"
  ).all(spotifyTrackId) as Array<{ username: string }>;
  const failedUsernames = new Set(failedUserRows.map((r) => r.username));

  if (failedUsernames.size >= MAX_AUTO_RETRIES) return null;

  if (!await ensureConnected()) return null;

  const track = db.prepare("SELECT title, artist, album FROM spotify_tracks WHERE id = ?")
    .get(spotifyTrackId) as { title: string; artist: string; album: string | null } | undefined;
  if (!track) return null;

  const firstArtist = track.artist.split(",")[0].trim();

  const queries = [
    `${track.artist} ${track.title}`,
    `${firstArtist} ${track.title}`,
    `${track.title} ${firstArtist}`,
  ];
  if (track.album) {
    queries.push(`${firstArtist} ${track.album} ${track.title}`);
  }

  for (const query of queries) {
    try {
      const results = await searchSoulseek(query);
      const candidate = results.find((r) =>
        !failedUsernames.has(r.username) && r.size > 500000
      );
      if (candidate) {
        return {
          username: candidate.username,
          file: candidate.file,
          size: candidate.size,
          format: candidate.format,
          bitrate: candidate.bitrate,
        };
      }
    } catch {}
    await sleep(2000);
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
