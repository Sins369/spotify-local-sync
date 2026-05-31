import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

function getDbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), "data", "sync.db");
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode and foreign keys
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create schema
  db.exec(schema);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

const schema = `
  CREATE TABLE IF NOT EXISTS local_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    filename TEXT,
    title TEXT,
    artist TEXT,
    album TEXT,
    album_artist TEXT,
    track_number INTEGER,
    disc_number INTEGER,
    year INTEGER,
    genre TEXT,
    duration_ms INTEGER,
    bitrate INTEGER,
    sample_rate INTEGER,
    codec TEXT,
    isrc TEXT,
    size_bytes INTEGER,
    mtime_ms INTEGER,
    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS spotify_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spotify_id TEXT NOT NULL UNIQUE,
    title TEXT,
    artist TEXT,
    album TEXT,
    album_artist TEXT,
    track_number INTEGER,
    disc_number INTEGER,
    year INTEGER,
    duration_ms INTEGER,
    isrc TEXT,
    popularity INTEGER,
    playlist_id TEXT,
    playlist_name TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_track_id INTEGER NOT NULL,
    spotify_track_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    confidence REAL NOT NULL,
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (local_track_id) REFERENCES local_tracks(id),
    FOREIGN KEY (spotify_track_id) REFERENCES spotify_tracks(id)
  );

  CREATE TABLE IF NOT EXISTS duplicate_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resolution TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS duplicate_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    local_track_id INTEGER NOT NULL,
    is_keeper INTEGER NOT NULL DEFAULT 0,
    quality_score REAL,
    FOREIGN KEY (group_id) REFERENCES duplicate_groups(id),
    FOREIGN KEY (local_track_id) REFERENCES local_tracks(id)
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spotify_track_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source_user TEXT,
    filename TEXT,
    download_path TEXT,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (spotify_track_id) REFERENCES spotify_tracks(id)
  );

  CREATE TABLE IF NOT EXISTS backup_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    dest_path TEXT NOT NULL,
    size INTEGER,
    mtime_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    backed_up_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_local_tracks_isrc ON local_tracks(isrc);
  CREATE INDEX IF NOT EXISTS idx_spotify_tracks_isrc ON spotify_tracks(isrc);
  CREATE INDEX IF NOT EXISTS idx_matches_local_track_id ON matches(local_track_id);
  CREATE INDEX IF NOT EXISTS idx_matches_spotify_track_id ON matches(spotify_track_id);
  CREATE INDEX IF NOT EXISTS idx_duplicate_members_group_id ON duplicate_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_backup_state_source_path ON backup_state(source_path);
`;
