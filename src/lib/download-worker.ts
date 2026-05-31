import { getDb } from "./db";
import { getSetting } from "./settings";
import { connectSoulseek, isConnected } from "./soulseek-client";
import { streamDownload } from "./soulseek-download";
import { writeTags } from "./metadata-writer";
import { renderPath } from "./file-organizer";
import path from "path";

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
    try {
      await Promise.race([
        connectSoulseek(username, password),
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
  const template = getSetting("file_template") || "{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}";
  const ext = download.format || path.extname(download.source_file).slice(1).toLowerCase() || "mp3";

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
      "UPDATE downloads SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(error, download.id);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
