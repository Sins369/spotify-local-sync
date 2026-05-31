# Download Queue Redesign — Design Spec

## Overview

Replace the synchronous, blocking Soulseek download system with an async queue-based architecture that supports real byte-level progress tracking, cancellation, and configurable concurrency. No external dependencies (Docker/slskd) — everything runs within the Next.js process.

## Problems Solved

1. Downloads block the API route until complete/fail — UI freezes
2. No download progress (slsk-client returns full Buffer on completion)
3. Large files buffered entirely in RAM before writing to disk
4. No retry or queue management
5. No way to cancel active downloads
6. "User not exist" errors with no recovery path

## Architecture

Three components:

### 1. Queue API (fire-and-forget)

`POST /api/soulseek/download` no longer downloads anything. It:
- Validates the request (username, file, spotify_track_id)
- Creates a DB record with status `queued` and all search result metadata (file_size, format, bitrate, source_file)
- Returns immediately with `{ download_id, status: "queued" }`
- The worker picks it up asynchronously

### 2. Download Worker (`src/lib/download-worker.ts`)

A singleton background loop running in the server process:

**Startup:** Auto-starts when first download is queued, or on server start if queued/interrupted downloads exist in DB.

**Loop:**
1. Query DB for `queued` downloads ordered by `created_at ASC`
2. If none, sleep 3 seconds, check again
3. Check current `downloading` count vs `max_concurrent_downloads` setting (default 1)
4. Pick next download, update status to `downloading`
5. Auto-connect to Soulseek if not connected (using stored credentials)
6. Stream download using forked download logic
7. On completion: write metadata tags, update status to `complete`
8. On failure: update status to `failed` with error message
9. Loop back to step 1

**Server restart recovery:** On startup, reset any `downloading` records back to `queued`.

**Progress tracking:** Worker maintains a `Map<downloadId, ProgressInfo>` in memory for active downloads. ProgressInfo includes: bytesReceived, totalSize, percent, speed (bytes/sec), startedAt.

### 3. Forked Download Logic (`src/lib/soulseek-download.ts`)

Uses slsk-client's undocumented `downloadStream()` method to get a ReadableStream of file data:

```
slskClient.downloadStream({ file: { user, file } })
  -> ReadableStream of chunks
  -> pipe to fs.createWriteStream(destPath)
  -> count bytes per chunk
  -> update progress Map
  -> on end: verify bytes === expected size
  -> on error: clean up partial file
```

**Key behaviors:**
- Streams to disk — no RAM buffering of entire file
- Progress: `bytesReceived / totalSize * 100` updated every chunk
- Speed: `bytesReceived / elapsedSeconds`
- Timeout: if no data for 30 seconds, abort and mark failed
- Cancellation: destroy the stream, delete partial file, update DB

### 4. Progress API

`GET /api/soulseek/queue` returns downloads merged with in-memory progress:

```json
{
  "downloads": [
    {
      "id": 1,
      "status": "downloading",
      "title": "Fine Day",
      "artist": "Sub Focus",
      "file_size": 37800000,
      "bytes_received": 17600000,
      "percent": 47,
      "speed": 2400000,
      "source_user": "BugMonkey",
      "format": "flac"
    }
  ],
  "stats": { "active": 1, "queued": 2, "completed": 5, "failed": 1, "total": 9 }
}
```

## Database Changes

Add columns to `downloads` table:

```sql
ALTER TABLE downloads ADD COLUMN file_size INTEGER;
ALTER TABLE downloads ADD COLUMN bytes_received INTEGER DEFAULT 0;
ALTER TABLE downloads ADD COLUMN format TEXT;
ALTER TABLE downloads ADD COLUMN bitrate INTEGER;
ALTER TABLE downloads ADD COLUMN source_file TEXT;
```

## Status Flow

```
queued -> downloading (0-100%) -> tagging -> complete
                               -> failed (error message)
```

Cancelled downloads: status set to `failed` with error "Cancelled by user".

## Settings

- `max_concurrent_downloads` — number of simultaneous downloads (default: 1, configurable in Settings)

## Downloads Page UI

- Real progress bar with percentage: "14.2 MB / 36.1 MB - 47%"
- Download speed: "2.3 MB/s"
- Time estimate: "~10s remaining"
- Queue position for waiting downloads: "#3 in queue"
- Cancel button (X) on queued and active downloads
- Clear Completed / Clear Failed bulk actions
- Poll every 2 seconds

## Sync Page Integration

No changes needed. The existing flow already:
1. Creates download record via POST
2. Shows "Queued" state on the card
3. Links to Downloads page

The only change is the POST now returns immediately instead of blocking.

## Files to Create/Modify

- **Create:** `src/lib/soulseek-download.ts` — streaming download with progress
- **Create:** `src/lib/download-worker.ts` — background queue processor
- **Modify:** `src/app/api/soulseek/download/route.ts` — fire-and-forget (just queue)
- **Modify:** `src/app/api/soulseek/queue/route.ts` — merge in-memory progress
- **Modify:** `src/app/downloads/page.tsx` — real progress bars, cancel, speed
- **Modify:** `src/lib/db.ts` — add new columns (migration)
- **Modify:** `src/app/settings/page.tsx` — add max concurrent downloads setting
