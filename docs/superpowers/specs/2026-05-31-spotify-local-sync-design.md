# Spotify Local Sync — Design Spec

## Overview

A self-hosted web application that bridges a local music collection with Spotify. Runs on a second PC, accesses music files from the main PC via network share (SMB), and provides a browser-based dashboard accessible from any device on the local network.

**Primary user:** Single user (Spotify dev mode, 5-user limit). Uses MusicBee Portable as their music player.

**Collection:** 5,000–20,000 tracks, mix of MP3 and FLAC.

## Core Features

1. **Missing Locally (Spotify → Local)** — Show tracks liked on Spotify that don't exist locally. Semi-automated Soulseek search and download with user-picked quality/format.
2. **Missing on Spotify (Local → Spotify)** — Show local tracks not in Spotify liked songs. Ability to like/save them on Spotify.
3. **Metadata Manager** — Use Spotify as source of truth. Bulk review side-by-side diffs of title, artist, album, artwork. Cherry-pick which changes to apply.
4. **Duplicate Detection** — Find duplicate tracks in the local library by metadata similarity. Review and resolve with safety (trash folder, undo).
5. **Backup Sync** — One-way file sync from main PC to second PC. Soulseek downloads can be pushed back to main PC.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SECOND PC (Server)                │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │           Next.js App (port 3000)             │  │
│  │                                               │  │
│  │  ┌─────────────┐     ┌────────────────────┐   │  │
│  │  │  React UI   │     │   API Routes       │   │  │
│  │  │  Dashboard  │◄───►│                    │   │  │
│  │  │  (Tailwind) │     │  /api/scan         │   │  │
│  │  └─────────────┘     │  /api/spotify      │   │  │
│  │                      │  /api/soulseek     │   │  │
│  │                      │  /api/metadata     │   │  │
│  │                      │  /api/backup       │   │  │
│  │                      │  /api/duplicates   │   │  │
│  │                      └────────┬───────────┘   │  │
│  └───────────────────────────────┼───────────────┘  │
│                                  │                  │
│  ┌──────────┐  ┌─────────┐  ┌───┴──────┐          │
│  │ Backup   │  │ Spotify │  │  SQLite  │          │
│  │ Storage  │  │ Auth    │  │  Cache   │          │
│  │ D:\Music │  │ (PKCE)  │  │  + State │          │
│  └──────────┘  └─────────┘  └──────────┘          │
└──────────────────────┬──────────────────────────────┘
                       │ Network Share (SMB)
                       │ \\MAIN-PC\Music
┌──────────────────────┴──────────────────────────────┐
│                    MAIN PC                          │
│              Music source directory                 │
└─────────────────────────────────────────────────────┘
```

- Next.js runs on the second PC, accessible at `http://<second-pc-ip>:3000`
- Music files read from the main PC via Windows network share
- SQLite database on the second PC stores all state
- Backup storage on the second PC's local drive

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Frontend:** React, Tailwind CSS, shadcn/ui
- **Database:** SQLite via `better-sqlite3` (WAL mode)
- **Music Metadata Reading:** `music-metadata`
- **Music Metadata Writing:** `node-id3` (MP3), child process for FLAC tag writing
- **Spotify Auth:** OAuth 2.0 PKCE flow (custom implementation)
- **Soulseek:** `slsk-client`
- **Fuzzy Matching:** `string-similarity` (Dice's coefficient)
- **File Watching:** `chokidar`
- **Music Player:** MusicBee Portable (external — file organization should match MusicBee's format)

## Spotify Integration

### Authentication

- OAuth 2.0 with PKCE (no client secret needed)
- Redirect URI: `http://localhost:3000/api/spotify/callback` (user opens the auth link directly on the server machine, or the redirect URI is configured to the server's LAN IP in Spotify Developer Dashboard)
- Scopes: `user-library-read`, `user-library-modify`
- Refresh token stored in SQLite, auto-refreshes on expiry (1 hour access token lifetime)
- Token rotation: always persist the latest refresh token after each refresh

### Dev Mode Constraints

- Requires Spotify Premium on the app owner's account
- Limited to 5 allowlisted users
- Search results capped at 10 per page
- No batch track fetching — individual `GET /tracks/{id}` only
- Rate limits on a rolling 30-second window (lower than extended quota)

### Library Sync

- Fetches all liked/saved tracks via `GET /me/tracks` (paginated, 50 per request)
- Stores in `spotify_tracks` table
- Incremental sync on subsequent runs: only fetches new additions by comparing `added_at` timestamps
- 200ms delay between pages to respect rate limits
- Exponential backoff on 429 responses with `Retry-After` header

### Matching Strategy (Waterfall)

**Tier 1: ISRC Match (highest confidence)**
- If local file has ISRC in tags, search Spotify with `isrc:{ISRC}`
- ~5-10% of local files typically have ISRC
- One API call per ISRC

**Tier 2: Title + Artist Search (medium-high confidence)**
- Normalize both strings:
  - Unicode normalize (NFC)
  - Lowercase
  - Strip parenthetical suffixes: (feat. X), (Remastered), (Deluxe), (Radio Edit)
  - Remove punctuation and special characters
  - Collapse whitespace
  - Handle "feat.", "ft.", "featuring", "&" in artist names
- Search Spotify: `track:{title} artist:{artist}`
- Score results using fuzzy string similarity (Dice's coefficient) + duration comparison (±5 seconds)

**Confidence Levels:**
- **Confirmed** (>90% similarity + duration match) — auto-accepted
- **Probable** (70-90%) — shown for manual review
- **No match** — listed separately

### Liking Tracks

- `PUT /me/library` with Spotify URIs
- Batched up to 50 per request
- Pre-check with `GET /me/library/contains` to avoid duplicates

## Soulseek Integration

### Connection

- `slsk-client` connects to Soulseek network from the server
- Soulseek username/password stored in SQLite settings (encrypted at rest)
- Persistent connection while app is running, auto-reconnect

### Search & Download Flow

1. User clicks "Search Soulseek" on a missing track
2. App searches with `"Artist - Title"` query
3. Results displayed with: source user, format, bitrate, file size, upload speed, queue position
4. User picks a result and clicks "Download"
5. File downloads to second PC's backup storage
6. After download, metadata auto-tagged from Spotify data (title, artist, album, track number, artwork)

### Batch Search

- Select multiple missing tracks → "Search All"
- Searched sequentially (Soulseek rate limits aggressive searching)
- Results shown in a review queue — user approves/skips per track
- Approved downloads queue and process one at a time

### Download Management

- Download queue with progress bars
- Retry on failure (peer offline, timeout)
- Status flow: Searching → Results Ready → Downloading → Tagging → Complete
- Download history stored in SQLite

### File Organization

- Configurable path template, defaulting to MusicBee's format:
  `{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}`
- Template variables: `{AlbumArtist}`, `{Artist}`, `{Album}`, `{TrackNo}`, `{DiscNo}`, `{Title}`, `{Year}`, `{ext}`
- Destination path configurable in settings (e.g., `D:\Music\`)

## Metadata Manager

### How It Works

- For every matched track, compare local file tags against Spotify metadata
- Fields compared: title, artist, album, album artist, track number, artwork
- Differences highlighted in the UI

### Review Flow

- Table showing all tracks with metadata differences
- Side-by-side view: local value vs Spotify value, differences highlighted
- Artwork preview: current embedded art vs Spotify album art
- Checkbox per row to approve changes
- "Select All Differences" + "Apply Selected" for bulk cleanup

### Tag Writing

- Writes corrected tags back to the source files (on main PC via network share)
- MP3: `node-id3` for ID3v2 tag writing
- FLAC: child process for Vorbis Comment writing
- Artwork embedded as cover art in the file
- Original tags backed up in SQLite before overwriting

## Duplicate Detection

### Detection Method

- During library scan, tracks grouped by normalized key: `lowercase(title) + lowercase(artist) + duration (±5 seconds)`
- Groups with 2+ entries flagged as duplicates

### Duplicate Types

1. **Exact duplicates** — same song, same format, same file size (accidental copies)
2. **Format duplicates** — same song in MP3 and FLAC
3. **Near duplicates** — same song, different versions (remastered vs original)

### Review Page

- Each duplicate group shown as a card
- Per copy: file path, format, bitrate, file size, has artwork, metadata completeness score
- Auto-recommendation: higher quality format > higher bitrate > better metadata > shorter path
- Actions: "Keep Best", "Keep This One", "Keep All" (dismiss), "Merge Metadata"

### Safety

- Deleted files moved to a configurable trash/recycle folder (never permanently deleted)
- Undo available until trash is manually emptied
- All actions logged in SQLite

## Backup Sync

### Direction

- Primary: Main PC (source) → Second PC (backup destination)
- Secondary: Soulseek downloads on second PC can be pushed back to main PC

### Change Detection

- Compare file path, size, and modification time
- New files → queued for copy
- Modified files → queued for overwrite
- Deleted from source → flagged for review (not auto-deleted from backup)

### Sync Modes

- **Mirror** — backup matches source exactly; deletions flagged for review
- **Additive** — only copies new/modified files, never removes from backup

### Backup Page

- Summary: total files synced, pending copies, last sync time, storage used
- Pending changes list: new, modified, deleted-from-source
- "Sync Now" with progress bar
- Optional scheduled sync (e.g., daily at 3am)
- History log
- Storage stats with breakdown by format

## Dashboard Pages

### 1. Dashboard (Home)
- Overview stats: total local tracks, matched to Spotify, unmatched, duplicates found
- Last scan time, sync status
- Quick actions: "Scan Library", "Sync Spotify", "Check for Duplicates"

### 2. Missing Locally (Spotify → Local)
- Table of tracks liked on Spotify but not in local collection
- Columns: Title, Artist, Album, Album Art
- "Search Soulseek" per track or bulk
- Filter/sort by artist, album, date added

### 3. Missing on Spotify (Local → Spotify)
- Table of local tracks not in Spotify liked songs
- "Like on Spotify" per track or bulk
- "Not on Spotify" tracks flagged separately

### 4. Metadata Manager
- Side-by-side diff table of local vs Spotify metadata
- Bulk review with cherry-pick
- Artwork preview

### 5. Duplicates
- Duplicate group cards with comparison
- Resolution actions with safety

### 6. Backup
- Sync status, pending changes, history
- Storage stats

## Data Model (SQLite)

```sql
local_tracks (
  id              INTEGER PRIMARY KEY,
  path            TEXT UNIQUE NOT NULL,
  size            INTEGER NOT NULL,
  mtime_ms        INTEGER NOT NULL,
  title           TEXT,
  artist          TEXT,
  album_artist    TEXT,
  album           TEXT,
  track_no        INTEGER,
  disc_no         INTEGER,
  year            INTEGER,
  genre           TEXT,
  duration_ms     INTEGER,
  isrc            TEXT,
  format          TEXT,
  bitrate         INTEGER,
  has_artwork     INTEGER,
  scanned_at      TEXT NOT NULL
)

spotify_tracks (
  id              INTEGER PRIMARY KEY,
  spotify_id      TEXT UNIQUE NOT NULL,
  uri             TEXT NOT NULL,
  title           TEXT,
  artist          TEXT,
  album           TEXT,
  album_art_url   TEXT,
  isrc            TEXT,
  duration_ms     INTEGER,
  added_at        TEXT,
  synced_at       TEXT NOT NULL
)

matches (
  id              INTEGER PRIMARY KEY,
  local_track_id  INTEGER REFERENCES local_tracks(id),
  spotify_track_id INTEGER REFERENCES spotify_tracks(id),
  method          TEXT NOT NULL,
  confidence      REAL NOT NULL,
  confirmed       INTEGER DEFAULT 0,
  matched_at      TEXT NOT NULL
)

duplicate_groups (
  id              INTEGER PRIMARY KEY,
  resolution      TEXT,
  resolved_at     TEXT
)

duplicate_members (
  id              INTEGER PRIMARY KEY,
  group_id        INTEGER REFERENCES duplicate_groups(id),
  local_track_id  INTEGER REFERENCES local_tracks(id),
  is_keeper       INTEGER DEFAULT 0,
  quality_score   REAL
)

downloads (
  id              INTEGER PRIMARY KEY,
  spotify_track_id INTEGER REFERENCES spotify_tracks(id),
  status          TEXT NOT NULL,
  source_user     TEXT,
  filename        TEXT,
  format          TEXT,
  bitrate         INTEGER,
  file_size       INTEGER,
  started_at      TEXT,
  completed_at    TEXT,
  destination_path TEXT
)

backup_state (
  id              INTEGER PRIMARY KEY,
  source_path     TEXT NOT NULL,
  dest_path       TEXT NOT NULL,
  size            INTEGER,
  mtime_ms        INTEGER,
  last_synced_at  TEXT,
  status          TEXT NOT NULL
)

settings (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL
)
```

## API Routes

```
POST   /api/scan              — trigger library scan
GET    /api/scan/progress      — SSE stream for scan progress
GET    /api/scan/stats         — get scan statistics

GET    /api/spotify/auth       — initiate PKCE auth flow
GET    /api/spotify/callback   — OAuth callback
POST   /api/spotify/sync       — sync liked songs from Spotify
POST   /api/spotify/like       — like tracks on Spotify (body: spotify URIs)
GET    /api/spotify/status     — connection/auth status

POST   /api/match/run          — run matching engine
GET    /api/match/results      — get match results (filterable by confidence)
POST   /api/match/confirm      — confirm/reject a match

POST   /api/soulseek/connect   — connect to Soulseek
POST   /api/soulseek/search    — search for a track
GET    /api/soulseek/results   — get search results
POST   /api/soulseek/download  — queue a download
GET    /api/soulseek/queue     — get download queue status

GET    /api/metadata/diffs     — get metadata differences
POST   /api/metadata/apply     — apply selected tag changes

GET    /api/duplicates         — get duplicate groups
POST   /api/duplicates/resolve — resolve a duplicate group

GET    /api/backup/status      — get backup sync status
POST   /api/backup/sync        — trigger backup sync
GET    /api/backup/history     — get sync history

GET    /api/settings           — get settings
PUT    /api/settings           — update settings
```

## Settings (Configurable via UI)

- **Music source path:** Network share path (e.g., `\\MAIN-PC\Music`)
- **Backup destination:** Local path on second PC (e.g., `D:\Music\Backup`)
- **File organization template:** Default `{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}`
- **Spotify Client ID:** From Spotify Developer Dashboard
- **Soulseek credentials:** Username and password
- **Backup sync mode:** Mirror or Additive
- **Scheduled backup:** Cron expression or disabled
- **Trash folder path:** Where deleted duplicates go
- **Supported file extensions:** Default `mp3,flac,m4a,aac,ogg,opus,wav,aiff`
