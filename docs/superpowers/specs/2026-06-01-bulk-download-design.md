# Bulk Download — Design Spec

## Overview

Add bulk download capability to the "Missing Locally" tab on the Sync page. Users can download all, selected, or batched tracks with automatic source selection from Soulseek. Uses a pipeline architecture: searches run ahead while downloads process, keeping the queue fed without waiting for all searches to complete.

## UI Changes

### Sync Page — Bulk Action Bar

Add a bar between the tabs and the split panel, visible only on the "Missing Locally" tab:

- **Checkboxes** on each track row in the left panel (before track title)
- **Select all / Deselect all** text buttons (left side of bar)
- **Batch size selector**: dropdown with 10 / 25 / 50 / All options (default: 25)
- **"Download Selected"** button — visible when any checkboxes are ticked. Label shows count: "Download 12 Selected"
- **"Download All"** button — queues all visible (filtered) tracks up to batch size. If batch < total, label shows "Download Next 25"

Button styling: "Download All/Selected" uses accent primary (`#34d399`), same as Best Match button.

### Bulk Progress Indicator

When a bulk operation is running, replace the bulk action bar with a progress bar:

- "Searching 15/200... · 8 queued · 3 completed · 1 failed"
- Green progress bar showing overall completion (searched + downloaded / total)
- "Cancel" button (text link, `#e05566`) to stop the bulk operation
- "Pause" button to pause searching but let current downloads finish

When bulk completes, show a summary briefly: "Bulk complete: 18 downloaded · 5 queued · 2 unavailable" then revert to the action bar.

### Track Row Updates

Each track in the left panel gets:
- Checkbox (left side, before title)
- Status indicator (right side): none (default), spinner (searching), "QUEUED" badge, "NO RESULTS" badge (dim)
- Tracks that are searching/queued get 50% opacity like the current downloaded tracks

## Backend

### New: `POST /api/soulseek/bulk-download`

Request body:
```json
{
  "trackIds": [1132, 1498, 2014],
  "qualityPref": "flac",
  "batchSize": 25
}
```

If `trackIds` is empty or omitted, uses all unmatched Spotify tracks (missing locally, no existing download).

Response (immediate):
```json
{
  "started": true,
  "totalTracks": 25
}
```

Internally:
1. Validates track IDs exist and don't already have downloads
2. Starts the bulk pipeline in the background (fire-and-forget)
3. Returns immediately

### New: `GET /api/soulseek/bulk-progress`

SSE endpoint streaming progress events:

```json
{"type": "searching", "trackId": 1132, "searched": 5, "total": 25}
{"type": "found", "trackId": 1132, "source": "username", "format": "flac", "size": 30000000}
{"type": "no_results", "trackId": 1498, "retryLater": true}
{"type": "queued", "trackId": 1132, "downloadId": 45}
{"type": "progress", "searched": 15, "queued": 8, "completed": 3, "failed": 1, "total": 25}
{"type": "done", "completed": 18, "queued": 5, "unavailable": 2}
```

### New: `POST /api/soulseek/bulk-cancel`

Stops the bulk search pipeline. Downloads already queued continue (managed by existing download worker).

### Bulk Pipeline Logic (`src/lib/bulk-downloader.ts`)

New module with a pipeline architecture:

```
Track IDs → [Search Queue] → [Source Picker] → [Download Queue]
                                                     ↓
                                              [Download Worker]
                                              (existing, unchanged)
```

**Search phase:**
- Processes tracks from the search queue one at a time (8s per search)
- Searches with query: `"{firstArtist} {title}"`
- If no results, tries variation: `"{title} {firstArtist}"`
- Keeps 5 tracks "searched ahead" of what's been queued for download

**Source picker — quality preference logic:**
- `flac`: pick FLAC source → fall back to highest bitrate MP3/M4A/other
- `mp3`: pick MP3 only (highest bitrate), skip FLAC/lossless
- `any`: pick best available (FLAC > WAV > M4A > MP3, sorted by bitrate within format)
- Filter out sources < 500KB (likely corrupt)
- Prefer users with free slots (from search result's `queueLength`)

**Download queueing:**
- For each track with a source found, insert into `downloads` table with status `queued`
- Existing download worker picks them up and processes them
- No changes needed to download worker

**Retry pool:**
- Tracks with no results on first search go into a retry list
- After all initial tracks are searched, wait 5 minutes then retry
- Max 2 retry rounds
- After final retry, tracks marked as "unavailable" (emitted via SSE)

### State Management

Global state for the bulk pipeline (similar to backup worker pattern):

```typescript
const globalForBulk = globalThis as unknown as {
  __bulkRunning: boolean;
  __bulkCancelled: boolean;
};
```

Only one bulk operation can run at a time. Starting a new one while running returns 409.

## Files to Create/Modify

### Create
- `src/lib/bulk-downloader.ts` — pipeline logic, search queue, source picker, retry pool
- `src/app/api/soulseek/bulk-download/route.ts` — POST handler, starts pipeline
- `src/app/api/soulseek/bulk-progress/route.ts` — GET SSE handler
- `src/app/api/soulseek/bulk-cancel/route.ts` — POST cancel handler

### Modify
- `src/app/sync/page.tsx` — add bulk action bar, checkboxes, progress indicator, cancel button

## Edge Cases

- User navigates away during bulk: pipeline continues in background, progress resumes when they return
- Server restart during bulk: queued downloads resume (existing auto-start), but search pipeline stops. User must re-trigger.
- Soulseek disconnects during bulk: `ensureConnected()` reconnects automatically before each search
- Track already has a download (queued/complete): skip, don't create duplicate download records
- All results are from failed users: try next search variation, then add to retry pool
