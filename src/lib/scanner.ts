import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { eventBus } from "./event-bus";

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wav",
  ".aiff",
  ".aif",
  ".wma",
]);

export interface TrackMetadata {
  path: string;
  size: number;
  mtime_ms: number;
  title: string | null;
  artist: string | null;
  album_artist: string | null;
  album: string | null;
  track_no: number | null;
  disc_no: number | null;
  year: number | null;
  genre: string | null;
  duration_ms: number | null;
  isrc: string | null;
  format: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  has_artwork: boolean;
}

/**
 * Recursively walk directories and return absolute paths of audio files.
 */
export async function discoverFiles(rootPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(rootPath);
  return results;
}

/**
 * Extract metadata from an audio file using music-metadata.
 * Returns base object with null metadata fields on parse failure.
 */
export async function extractMetadata(filePath: string): Promise<TrackMetadata> {
  const stat = fs.statSync(filePath);
  const base: TrackMetadata = {
    path: filePath,
    size: stat.size,
    mtime_ms: Math.floor(stat.mtimeMs),
    title: null,
    artist: null,
    album_artist: null,
    album: null,
    track_no: null,
    disc_no: null,
    year: null,
    genre: null,
    duration_ms: null,
    isrc: null,
    format: null,
    bitrate: null,
    sample_rate: null,
    has_artwork: false,
  };

  try {
    const mm = await import("music-metadata");
    const metadata = await mm.parseFile(filePath, { skipCovers: false });
    const { common, format } = metadata;

    base.title = common.title ?? null;
    base.artist = common.artist ?? null;
    base.album_artist = common.albumartist ?? null;
    base.album = common.album ?? null;
    base.track_no = common.track?.no ?? null;
    base.disc_no = common.disk?.no ?? null;
    base.year = common.year ?? null;
    base.genre = common.genre?.[0] ?? null;
    base.duration_ms = format.duration != null ? Math.round(format.duration * 1000) : null;
    base.isrc = (common as unknown as Record<string, unknown>).isrc as string ?? null;
    base.format = format.container ?? null;
    base.bitrate = format.bitrate != null ? Math.round(format.bitrate) : null;
    base.sample_rate = format.sampleRate ?? null;
    base.has_artwork = Array.isArray(common.picture) && common.picture.length > 0;
  } catch {
    // Parse failure — return base with null metadata fields
  }

  return base;
}

/**
 * Scan a music library directory: discover files, extract metadata, and upsert into the database.
 * Emits events via eventBus: scan:start, scan:progress, scan:complete.
 */
export async function scanLibrary(
  rootPath: string,
  db: Database.Database
): Promise<void> {
  eventBus.emit("scan:start", { rootPath });

  const files = await discoverFiles(rootPath);
  const total = files.length;

  // Prepared statement to check if a track already exists with same path, size, and mtime
  const checkStmt = db.prepare(
    "SELECT size_bytes, mtime_ms FROM local_tracks WHERE path = ?"
  );

  // Prepared statement for upsert
  const upsertStmt = db.prepare(`
    INSERT INTO local_tracks (
      path, filename, title, artist, album, album_artist,
      track_number, disc_number, year, genre, duration_ms,
      bitrate, sample_rate, codec, isrc, size_bytes, mtime_ms, scanned_at
    ) VALUES (
      @path, @filename, @title, @artist, @album, @album_artist,
      @track_number, @disc_number, @year, @genre, @duration_ms,
      @bitrate, @sample_rate, @codec, @isrc, @size_bytes, @mtime_ms, datetime('now')
    )
    ON CONFLICT(path) DO UPDATE SET
      filename = @filename,
      title = @title,
      artist = @artist,
      album = @album,
      album_artist = @album_artist,
      track_number = @track_number,
      disc_number = @disc_number,
      year = @year,
      genre = @genre,
      duration_ms = @duration_ms,
      bitrate = @bitrate,
      sample_rate = @sample_rate,
      codec = @codec,
      isrc = @isrc,
      size_bytes = @size_bytes,
      mtime_ms = @mtime_ms,
      scanned_at = datetime('now')
  `);

  let scanned = 0;

  for (const filePath of files) {
    // Check if file is unchanged
    const existing = checkStmt.get(filePath) as
      | { size_bytes: number; mtime_ms: number }
      | undefined;

    const stat = fs.statSync(filePath);
    const sizeBytes = stat.size;
    const mtimeMs = Math.floor(stat.mtimeMs);

    if (
      existing &&
      existing.size_bytes === sizeBytes &&
      existing.mtime_ms === mtimeMs
    ) {
      scanned++;
      eventBus.emit("scan:progress", { total, scanned, current: filePath });
      continue;
    }

    const meta = await extractMetadata(filePath);

    upsertStmt.run({
      path: meta.path,
      filename: path.basename(filePath),
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      album_artist: meta.album_artist,
      track_number: meta.track_no,
      disc_number: meta.disc_no,
      year: meta.year,
      genre: meta.genre,
      duration_ms: meta.duration_ms,
      bitrate: meta.bitrate,
      sample_rate: meta.sample_rate,
      codec: meta.format,
      isrc: meta.isrc,
      size_bytes: meta.size,
      mtime_ms: meta.mtime_ms,
    });

    scanned++;
    eventBus.emit("scan:progress", { total, scanned, current: filePath });
  }

  eventBus.emit("scan:complete", { total, scanned });
}
