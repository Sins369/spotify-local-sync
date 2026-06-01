import { getDb } from "./db";
import { getSetting } from "./settings";
import { connectSoulseek, isConnected, searchSoulseek } from "./soulseek-client";
import { streamDownload } from "./soulseek-download";
import { writeTags } from "./metadata-writer";
import path from "path";

const MAX_AUTO_RETRIES = 3;

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
    processDownload(download);
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

  } catch (err) {
    const error = err instanceof Error ? err.message : "Download failed";
    db.prepare(
      "INSERT OR IGNORE INTO failed_users (spotify_track_id, username) VALUES (?, ?)"
    ).run(download.spotify_track_id, download.source_user);

    const isUserBlock = error.includes("not responding") || error.includes("timed out");
    if (isUserBlock) {
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

    db.prepare(
      "UPDATE downloads SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(error, download.id);
  }
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

  const track = db.prepare("SELECT title, artist FROM spotify_tracks WHERE id = ?")
    .get(spotifyTrackId) as { title: string; artist: string } | undefined;
  if (!track) return null;

  try {
    const results = await searchSoulseek(`${track.artist} ${track.title}`);
    const candidate = results.find((r) => !failedUsernames.has(r.username));
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

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
