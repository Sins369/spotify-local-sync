# Full UI Redesign — Design Spec

## Overview

Complete visual overhaul of all 9 pages based on the Claude Design prototype (Soft Carbon + Neon), switching from sidebar to top nav, with functionality improvements across every page.

## Design System

### Colors
- Background deep: `#12121c`
- Background card: `#1c1c28`
- Background hover: `#24243a`
- Background input: `#141420`
- Border: `rgba(255,255,255,0.06)`
- Border hover: `rgba(255,255,255,0.12)`
- Text primary: `#e0e0e8`
- Text mid: `#8888a0`
- Text dim: `#5a5a6e`
- Text faint: `#3a3a4e`
- Accent primary: `#34d399` (green)
- Accent secondary: `#f59e0b` (amber)
- Danger: `#e05566`

### Typography
- UI font: DM Sans (400/500/600/700/800)
- Data font: JetBrains Mono (400/500/600/700)
- Section labels: 10px, weight 700, letter-spacing 1.5px, uppercase, color `#5a5a6e`
- Stat values: 28px, weight 800, letter-spacing -0.5px
- Page headers: 22px, weight 800

### Card Style
- Background: `#1c1c28`
- Border: `1px solid rgba(255,255,255,0.06)`
- Border radius: 4px
- Padding: 16px
- Glow effects on accent-colored elements: `box-shadow: 0 0 16px {color}33`

## Navigation

Replace sidebar with top horizontal nav bar.

- Height: 48px
- Background: `#161620`
- Logo left: colored grid icon + "Spotify to Local" in accent primary
- Nav items: Dashboard, Sync, Downloads, Library, Metadata, Duplicates, Backup, Settings
- Active state: accent primary text + subtle background
- Task counts as small badges on Sync, Downloads, Metadata, Duplicates
- Version number right-aligned

## Database Changes

### New: activity_log table
```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail TEXT,
  color TEXT DEFAULT 'primary',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### New: backup_history table
```sql
CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  files_synced INTEGER NOT NULL DEFAULT 0,
  files_new INTEGER NOT NULL DEFAULT 0,
  files_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'complete',
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Log activity events when: scan completes, Spotify syncs, matching runs, downloads complete/fail, duplicates resolved, metadata applied, backup runs.

## Page 1: Dashboard

Two-column layout: main content (flex 3) + activity log (flex 2).

### Header
- Large text: "{matchPct}% SYNCED"
- Subtitle: "{local} local . {spotify} Spotify . last scan {time} ago"
- "HEALTHY" badge (green border + background) when match rate > 80%

### Collection Breakdown Card
- Segmented horizontal bar (height 38px):
  - Local Only segment: `#2e2e3c` with label inside
  - Matched segment: accent primary with glow shadow, label inside
  - Spotify Only segment: accent secondary with glow shadow, label inside
- Below: two coverage progress bars side by side
  - Local library: "{count} . {pct}%" with filled bar
  - Spotify likes: "{count} . {pct}%" with filled bar

### Task Cards
- 4 cards in a responsive grid (min 180px each)
- Each shows: large number, uppercase label, action text with arrow
- Missing locally (secondary color), Not on Spotify (primary), Metadata diffs (gray), Duplicates (danger)
- Hover: border color changes to card's accent
- Click: navigates to the relevant page

### Quick Actions
- 4 buttons in responsive grid (min 120px)
- Scan Library, Sync Spotify, Run Matching, Backup
- Click: fills with progress animation (real SSE progress for scan/match)
- Running state: accent primary background, percentage text

### Activity Log (right column)
- Section label: "RECENT ACTIVITY"
- Card with scrollable list
- Each entry: timestamp (JetBrains Mono), colored dot, action title, detail text
- Populated from activity_log table, most recent first

## Page 2: Sync

Split panel with persistent download queue bar at bottom.

### Header
- Page title + subtitle
- Underline tabs: "Missing Locally" (secondary color, count) + "Not on Spotify" (primary color, count)

### Download Tab -- Left Panel (35%, min 280px, max 400px)
- Search input
- Quality preference selector: FLAC / MP3 / Any toggle buttons
- Scrollable track list (no pagination)
- Default sort: newest Spotify liked first (by added_at descending)
- Each track: title, artist, source count or "NO RESULTS" or "QUEUED" badge
- Selected track: left border highlight (3px accent secondary)
- Queued tracks: 50% opacity

### Download Tab -- Right Panel
- Track header: album art placeholder, title (18px bold), artist, album
- "Best match" button: accent primary, auto-picks based on quality preference
- Spotify embed preview (real iframe, preloaded for visible tracks)
- Soulseek results section:
  - Auto-searches when track selected
  - Each result: filename, format badge (FLAC highlighted), bitrate, size, username
  - "PREFERRED" badge on results matching quality preference
  - Failed users: red text, "FAILED" badge, disabled download button
  - "Download" button per result
- Auto-advance to next track after queueing a download

### Like Tab
- Bulk action bar: Select all / Deselect all + "Like {N} on Spotify" button
- Track list with checkboxes
- "NOT ON SPOTIFY" badge for tracks without URI

### Persistent Download Queue Bar (bottom)
- Shows when queue has items
- Section label: "Download Queue . {completed}/{total} complete"
- "View all" link to Downloads page
- Horizontal scrollable row of last 5 queued items with progress

## Page 3: Downloads

Grouped sections instead of filter cards.

### Header
- Page title + total count
- "Retry Failed" button (retries all failed downloads)
- "Clear Queue" button (cancels all queued, moves to failed with "Cancelled by user")
- Open Folder button (opens download location folder in Windows Explorer)

### Sections (in order)
1. **Active** -- currently downloading, real byte-level progress bar with percentage, bytes received/total, speed
2. **Queued** -- waiting to download, shows queue position
3. **Failed** -- error message shown, inline retry panel (Soulseek re-search) expandable per item, failed user tracking
4. **Completed** -- file path shown, remove button

### Per-download card
- Album art (if available) + title + artist + album
- Source user + filename
- Format badge + bitrate
- Status badge (DOWNLOADING/QUEUED/FAILED/COMPLETE)
- Progress bar for active (real bytes/speed from download worker)
- Cancel button for queued/active
- Retry button for failed (expands inline Soulseek search)
- Remove button for completed/failed

## Page 4: Library

Single unified page combining Local Library and Spotify Library.

### Header
- Page title + track counts
- Column toggle dropdown (checkboxes)
- Search input
- Filter row: Format (All/FLAC/MP3/Other), Match Status (All/Matched/Unmatched), Source (All/Local Only/Spotify Only/Both)

### Table
- Toggleable columns: Title (always on), Artist, Album, Genre, Format, Bitrate, Duration, Year, Date Added to Spotify, File Path, Matched (dot indicator)
- Sortable columns (click header to sort)
- Default sort: Title ascending
- Matched status: colored dot with glow for matched, dim dot for unmatched
- Scrollable body, pagination footer ("Showing 1-20 of {total}")
- Hover highlight on rows

## Page 5: Metadata

Card-based layout grouped by track.

### Header
- Page title + "{N} tracks . {N} field differences"
- "Apply Selected" button (applies all checked tracks)

### Track Cards (responsive grid, min 380px)
- Checkbox for bulk selection
- Album art comparison: LOCAL art + SPOTIFY art side by side with labels
- "ART DIFFERS" badge when artwork is different
- Track header: title, artist, album + "Apply all ({N})" button per card
- All field diffs always visible (no expand):
  - Field name, local value (secondary color background), arrow, spotify value (primary color background)
  - Per-field "Apply" button
- Applied state: card fades to 40% opacity, field values get strikethrough + checkmark

## Page 6: Duplicates

Keep all current functionality, restyle with prototype design.

### Header
- Page title + "{N} groups . {N} total tracks"
- "Re-scan" button

### Duplicate Cards (responsive grid, min 300px)
- Track title + artist
- "Review" badge (yellow) on questionable duplicates (titles differ, different albums with large size gap)
- Warning text explaining why it needs review
- Each copy:
  - Genre folder path (4 levels deep)
  - Format badge (FLAC highlighted in primary color)
  - File size
  - "BEST" indicator on highest quality
  - Audio preview play/pause button
- Actions as text links: "Keep best . Keep all . Not duplicates"
- Stop playback when clicking any action
- Quality score based on format + bitrate + metadata completeness

## Page 7: Backup

Two-column layout.

### Left Column
- 3 stat cards: Source Files, Up to Date, Pending
- Progress bar with percentage
- "Sync Now" button with glow shadow
- Configuration card: Source path, Destination path, Total size (from settings)

### Right Column
- "BACKUP HISTORY" section label
- Scrollable list from backup_history table
- Each entry: status dot, date, files synced info, duration (JetBrains Mono)
- Color: green for complete, amber for partial

Log each backup run to backup_history table with: files_synced, files_new, files_failed, status, duration_ms.

## Page 8: Settings

Two-column layout.

### Left Column
- **Spotify Connection** -- status badge (CONNECTED/NOT CONNECTED) + Connect/Reconnect button
- **Paths** -- Music Source, Download Location, Backup Destination, Trash Folder. Each with editable text input + "Browse" button that opens native Windows folder picker dialog (via PowerShell API)

### Right Column
- **File Template** -- template input + "Detect" button + preview + variables list
- **Soulseek** -- username + password inputs + max concurrent downloads (1-5)
- **Cleanup** -- live stale record/empty folder counts + "Run Cleanup" button
- **Danger Zone** (red border) -- "Reset Database" button + "Disconnect Spotify" button with confirmation

### Native Folder Picker
Replace custom folder browser dialog with native Windows folder picker. New API endpoint `POST /api/folder-picker` that runs PowerShell to open the native dialog and returns the selected path.

## Files to Create/Modify

### Create
- `src/components/layout/topnav.tsx` -- top navigation bar
- `src/app/library/page.tsx` -- unified library page
- `src/app/api/folder-picker/route.ts` -- native Windows folder picker
- `src/app/api/activity/route.ts` -- GET activity log (most recent first, limit 50)
- `src/app/api/library/route.ts` -- unified library query (joins local_tracks + spotify_tracks with filters/sort/pagination)
- `src/app/api/soulseek/retry-failed/route.ts` -- POST retries all failed downloads (re-queues them)
- `src/app/api/soulseek/clear-queue/route.ts` -- POST cancels all queued downloads
- `src/app/api/backup/history/route.ts` -- GET backup history (if not already existing)

### Major Rewrites
- `src/app/layout.tsx` -- remove sidebar, add top nav, new fonts
- `src/app/page.tsx` -- dashboard redesign
- `src/app/sync/page.tsx` -- full sync page redesign
- `src/app/downloads/page.tsx` -- grouped sections redesign
- `src/app/metadata/page.tsx` -- card-based redesign
- `src/app/duplicates/page.tsx` -- restyle
- `src/app/backup/page.tsx` -- two-column with history
- `src/app/settings/page.tsx` -- two-column with danger zone + native picker

### Modify
- `src/lib/db.ts` -- add activity_log and backup_history tables
- `src/lib/backup-sync.ts` -- log to backup_history table
- Various API routes -- log activity events

### Delete
- `src/components/layout/sidebar.tsx` -- replaced by topnav
- `src/app/local-library/page.tsx` -- merged into library
- `src/app/spotify-library/page.tsx` -- merged into library
- `src/components/settings/folder-picker.tsx` -- replaced by native picker
