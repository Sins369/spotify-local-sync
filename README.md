# Spotify Local Sync

A self-hosted web app that bridges your local music collection with Spotify. Scan your library, match tracks, find gaps, download missing songs via Soulseek, manage metadata, detect duplicates, and back up your collection — all from a browser-based dashboard.

## Features

- **Library Scanning** — Recursively scans your local music folder (MP3, FLAC, M4A, OGG, WAV, AIFF) and extracts metadata
- **Spotify Sync** — Connects via OAuth PKCE to pull your liked/saved songs
- **Smart Matching** — Three-stage waterfall: ISRC exact match, case-insensitive title+artist, fuzzy normalized matching with duration comparison
- **Download to Local** — Search Soulseek for missing tracks, preview on Spotify, pick format/quality, download with auto-tagging
- **Like on Spotify** — Find local tracks not in your Spotify likes and bulk-like them
- **Metadata Manager** — Compare local tags against Spotify, review diffs side-by-side, apply corrections
- **Duplicate Detection** — Find duplicates across genre folders, compare quality, preview audio, ignore false positives (remixes etc.)
- **Backup Sync** — One-way file sync from source to backup with change detection
- **Cleanup** — Remove stale database records and empty folders
- **File Organization** — Configurable path template, auto-detected from your existing library structure

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Frontend | React, Tailwind CSS, shadcn/ui, Lucide icons |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Metadata | music-metadata (reading), node-id3 (MP3 writing) |
| P2P | slsk-client (Soulseek) |
| Matching | string-similarity (Dice coefficient) |

## Prerequisites

- **Node.js** 20+
- **Spotify Premium** account (required for dev mode API access)
- **Spotify Developer App** — [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
- **Soulseek account** — [slsknet.org](http://www.slsknet.org/) (for downloading)
- **metaflac** (optional) — for writing FLAC metadata tags

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Sins369/spotify-local-sync.git
cd spotify-local-sync
npm install
```

### 2. Configure Spotify

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://127.0.0.1:3002/api/spotify/callback` as a **Redirect URI**
4. Copy the **Client ID**

### 3. Create environment file

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3002
PORT=3002
```

### 4. Start the server

```bash
npx next dev --port 3002
```

Open **http://127.0.0.1:3002** in your browser.

### 5. Configure in Settings

1. **Connect Spotify** — click Connect, authorize in the popup
2. **Music Source Directory** — browse to your music folder
3. **Backup Destination** — where backup copies and downloads go
4. **Trash Folder** — where deleted duplicates are moved (not permanently deleted)
5. **Soulseek Credentials** — username and password
6. **File Template** — click **Detect** to auto-match your existing folder structure

### 6. First sync

From the Dashboard:

1. **Scan Library** — indexes all local tracks with metadata
2. **Sync Spotify** — pulls your liked songs into the database
3. **Run Matching** — links local tracks to Spotify (~1 min for 5000 tracks)
4. **Check Duplicates** — finds duplicate files across folders

## Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Stats, library overlap bar, quick actions with progress |
| **Local Library** | Searchable/sortable/paginated table of all local tracks |
| **Spotify Library** | Searchable/sortable/paginated table of Spotify liked songs |
| **Sync** | Download to Local (Soulseek search + Spotify preview) and Like on Spotify |
| **Metadata** | Side-by-side diff table with bulk apply |
| **Duplicates** | Card-based groups with audio preview, quality scoring, ignore/resolve |
| **Backup** | File sync status with progress |
| **Settings** | Spotify connection, folder browser, template detection, Soulseek, cleanup |

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Next.js App (port 3002)             │
│                                                  │
│  React Dashboard    API Routes                   │
│  8 pages       <->  /api/scan                    │
│                     /api/spotify                  │
│                     /api/match                    │
│                     /api/soulseek                 │
│                     /api/metadata                 │
│                     /api/duplicates               │
│                     /api/backup                   │
│                     /api/settings                 │
│                                                  │
│  SQLite (WAL)      Event Bus (SSE)               │
│  data/sync.db      real-time progress            │
└──────────────────────┬───────────────────────────┘
                       │
              Music Source Directory
              (local or network share)
```

## Matching Engine

Runs entirely against the local SQLite database — no Spotify API calls after initial sync:

| Stage | Method | Confidence |
|-------|--------|------------|
| 1 | ISRC exact match | 99% |
| 2 | Case-insensitive title + artist (also matches first artist for multi-artist tracks) | 98% |
| 3 | Normalized fuzzy match — strips feat., remastered, deluxe, punctuation, "The" prefix | 75-95% |

## File Organization

Auto-detected from your library. Common patterns:

```
{Genre}/{AlbumArtist}/{Album}/{Title} by {Artist}.{ext}
{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}
{Artist}/{Album}/{TrackNo} - {Title}.{ext}
```

Variables: `{AlbumArtist}`, `{Artist}`, `{Album}`, `{Title}`, `{Genre}`, `{TrackNo}`, `{DiscNo}`, `{Year}`, `{ext}`

## API Reference

<details>
<summary>Click to expand all endpoints</summary>

### Scan
- `POST /api/scan` — trigger library scan
- `GET /api/scan/progress` — SSE progress stream
- `GET /api/scan/stats` — dashboard statistics

### Spotify
- `GET /api/spotify/auth` — initiate PKCE OAuth
- `GET /api/spotify/callback` — OAuth callback
- `POST /api/spotify/sync` — sync liked songs
- `POST /api/spotify/like` — like tracks
- `GET /api/spotify/status` — connection status

### Matching
- `POST /api/match/run` — run matching engine
- `GET /api/match/progress` — SSE progress stream
- `GET /api/match/results?filter=` — results (confirmed, probable, missing_locally, missing_on_spotify)
- `POST /api/match/confirm` — confirm/reject match

### Soulseek
- `POST /api/soulseek/connect` — connect
- `POST /api/soulseek/search` — search tracks
- `POST /api/soulseek/download` — download file
- `GET /api/soulseek/queue` — download queue

### Metadata
- `GET /api/metadata/diffs` — metadata differences
- `POST /api/metadata/apply` — apply tag changes

### Duplicates
- `GET /api/duplicates` — duplicate groups
- `POST /api/duplicates` — detect duplicates (auto-cleans stale records)
- `POST /api/duplicates/resolve` — resolve (keep_one, keep_all, ignore)

### Backup
- `GET /api/backup/status` — sync status
- `POST /api/backup/sync` — trigger sync
- `GET /api/backup/history` — history

### Other
- `GET/PUT /api/settings` — settings
- `GET /api/browse?path=` — folder browser
- `GET /api/detect-template` — auto-detect file template
- `GET /api/preview?path=` — audio file streaming
- `GET/POST /api/cleanup` — stale record/empty folder cleanup

</details>

## Known Issues

See [Issues](../../issues) for current bugs and planned features.

## License

MIT
