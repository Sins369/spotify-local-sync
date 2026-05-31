# Spotify Local Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted web app that syncs between a local music collection and Spotify, with Soulseek downloading, metadata management, duplicate detection, and backup.

**Architecture:** Next.js 15 full-stack app with SQLite database. Backend API routes handle Spotify OAuth PKCE, library scanning via `music-metadata`, Soulseek via `slsk-client`, and file sync. React frontend with Tailwind CSS and shadcn/ui provides a 6-page dashboard.

**Tech Stack:** Next.js 15, React, Tailwind CSS, shadcn/ui, SQLite (better-sqlite3), music-metadata, node-id3, slsk-client, string-similarity, chokidar

**Spec:** `docs/superpowers/specs/2026-05-31-spotify-local-sync-design.md`

---

## File Structure

```
spotify-local-sync/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── .env.example
├── data/                              (gitignored — SQLite DB, tokens)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 (root layout with sidebar)
│   │   ├── page.tsx                   (dashboard home)
│   │   ├── missing-locally/
│   │   │   └── page.tsx
│   │   ├── missing-on-spotify/
│   │   │   └── page.tsx
│   │   ├── metadata/
│   │   │   └── page.tsx
│   │   ├── duplicates/
│   │   │   └── page.tsx
│   │   ├── backup/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── scan/route.ts
│   │       ├── scan/progress/route.ts
│   │       ├── scan/stats/route.ts
│   │       ├── spotify/auth/route.ts
│   │       ├── spotify/callback/route.ts
│   │       ├── spotify/sync/route.ts
│   │       ├── spotify/like/route.ts
│   │       ├── spotify/status/route.ts
│   │       ├── match/run/route.ts
│   │       ├── match/results/route.ts
│   │       ├── match/confirm/route.ts
│   │       ├── soulseek/connect/route.ts
│   │       ├── soulseek/search/route.ts
│   │       ├── soulseek/download/route.ts
│   │       ├── soulseek/queue/route.ts
│   │       ├── metadata/diffs/route.ts
│   │       ├── metadata/apply/route.ts
│   │       ├── duplicates/route.ts
│   │       ├── duplicates/resolve/route.ts
│   │       ├── backup/status/route.ts
│   │       ├── backup/sync/route.ts
│   │       ├── backup/history/route.ts
│   │       └── settings/route.ts
│   ├── lib/
│   │   ├── db.ts                      (SQLite connection, schema, migrations)
│   │   ├── settings.ts                (read/write settings from SQLite)
│   │   ├── scanner.ts                 (recursive file discovery + metadata extraction)
│   │   ├── normalize.ts               (string normalization for matching)
│   │   ├── matcher.ts                 (waterfall matching engine)
│   │   ├── spotify-auth.ts            (PKCE auth flow helpers)
│   │   ├── spotify-client.ts          (Spotify API wrapper with rate limiting)
│   │   ├── soulseek-client.ts         (Soulseek connection manager)
│   │   ├── metadata-writer.ts         (write tags to MP3/FLAC files)
│   │   ├── duplicate-detector.ts      (group tracks by similarity)
│   │   ├── backup-sync.ts             (file copy/sync logic)
│   │   ├── file-organizer.ts          (path template rendering)
│   │   └── event-bus.ts               (SSE event emitter for progress)
│   ├── components/
│   │   ├── ui/                        (shadcn/ui components)
│   │   ├── layout/
│   │   │   └── sidebar.tsx
│   │   ├── soulseek/
│   │   │   └── search-panel.tsx
│   │   ├── metadata/
│   │   │   └── diff-table.tsx
│   │   └── duplicates/
│   │       └── duplicate-card.tsx
│   └── types/
│       └── index.ts                   (shared TypeScript types)
└── tests/
    ├── lib/
    │   ├── db.test.ts
    │   ├── scanner.test.ts
    │   ├── normalize.test.ts
    │   ├── matcher.test.ts
    │   ├── spotify-auth.test.ts
    │   ├── spotify-client.test.ts
    │   ├── duplicate-detector.test.ts
    │   ├── backup-sync.test.ts
    │   ├── file-organizer.test.ts
    │   └── metadata-writer.test.ts
    └── fixtures/
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.example`, `.gitignore`, `src/types/index.ts`, `vitest.config.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd E:\Repos\spotify-local-sync
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3 music-metadata string-similarity chokidar node-id3 slsk-client
npm install -D @types/better-sqlite3 @types/string-similarity vitest @types/node-id3
```

- [ ] **Step 3: Initialize shadcn/ui and install components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card table checkbox input label select tabs badge progress dialog toast separator scroll-area dropdown-menu
```

- [ ] **Step 4: Create shared TypeScript types in `src/types/index.ts`**

All interfaces: `LocalTrack`, `SpotifyTrack`, `Match`, `DuplicateGroup`, `DuplicateMember`, `Download`, `BackupState`, `SoulseekResult`, `MetadataDiff`, `ScanProgress`. Full code in spec's data model section.

- [ ] **Step 5: Create `.env.example`, update `.gitignore` to exclude `data/`**

- [ ] **Step 6: Configure `next.config.ts` with `serverExternalPackages`**

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "music-metadata", "slsk-client", "node-id3", "chokidar"],
};
```

- [ ] **Step 7: Add vitest config with `@` alias**

- [ ] **Step 8: Verify app starts with `npm run dev`**

- [ ] **Step 9: `git init && git add -A && git commit`**

---

## Task 2: Database Layer

**Files:**
- Create: `src/lib/db.ts`, `src/lib/settings.ts`, `tests/lib/db.test.ts`

TDD: Write tests for DB initialization (tables exist, WAL mode, singleton), settings CRUD (get/set/overwrite/getAll). Then implement. Full schema from spec with all 8 tables and indexes.

---

## Task 3: String Normalization

**Files:**
- Create: `src/lib/normalize.ts`, `tests/lib/normalize.test.ts`

TDD: Test `normalizeTitle` (lowercase, strip remastered/feat/deluxe, remove punctuation, collapse whitespace), `normalizeArtist` (strip feat/ft/featuring, handle &/and, remove "The" prefix), `normalizeForKey` (combine for duplicate detection). Then implement.

---

## Task 4: Library Scanner

**Files:**
- Create: `src/lib/scanner.ts`, `src/lib/event-bus.ts`, `tests/lib/scanner.test.ts`

TDD: Test `discoverFiles` (finds only audio extensions, returns absolute paths), `extractMetadata` (handles corrupt files gracefully). Implement with `music-metadata` for reading tags, recursive directory walk, `scanLibrary` function that upserts to SQLite with change detection (skip files where size+mtime unchanged).

---

## Task 5: File Organizer

**Files:**
- Create: `src/lib/file-organizer.ts`, `tests/lib/file-organizer.test.ts`

TDD: Test `renderPath` with MusicBee template, missing fields fallback, track number padding, path-unsafe character sanitization. Then implement.

---

## Task 6: Spotify PKCE Auth

**Files:**
- Create: `src/lib/spotify-auth.ts`, `tests/lib/spotify-auth.test.ts`

TDD: Test `generateCodeVerifier` (length, uniqueness), `generateCodeChallenge` (base64url, no padding), `buildAuthUrl` (correct params, scopes). Implement `exchangeCodeForTokens` and `refreshAccessToken` (these call Spotify's token endpoint — tested via integration).

---

## Task 7: Spotify API Client

**Files:**
- Create: `src/lib/spotify-client.ts`, `tests/lib/spotify-client.test.ts`

TDD: Test `SpotifyClient` construction, header building, pagination through mocked responses. Implement `getAllSavedTracks` (paginated), `searchTrack`, `searchByIsrc`, `likeTracks` (batched to 50), `checkSaved`. All with `fetchWithRetry` (429 handling + exponential backoff).

---

## Task 8: Matching Engine

**Files:**
- Create: `src/lib/matcher.ts`, `tests/lib/matcher.test.ts`

TDD: Test `scoreMatch` (exact match, case insensitive, duration penalty, remastered handling), `classifyConfidence` (confirmed/probable/no_match thresholds). Implement waterfall: ISRC lookup → title+artist fuzzy search → score with `string-similarity` + duration comparison.

---

## Task 9: Duplicate Detector

**Files:**
- Create: `src/lib/duplicate-detector.ts`, `tests/lib/duplicate-detector.test.ts`

TDD: Test `findDuplicateGroups` (groups same title+artist within 5s duration, doesn't group different songs), `scoreTrackQuality` (FLAC > MP3, higher bitrate wins, artwork bonus). Then implement.

---

## Task 10: Backup Sync

**Files:**
- Create: `src/lib/backup-sync.ts`, `tests/lib/backup-sync.test.ts`

TDD: Test `detectChanges` (new files, modified files, unchanged files skipped), `copyFile` (preserves directory structure, creates dirs). Implement `runBackupSync` with event bus progress.

---

## Task 11: Metadata Writer

**Files:**
- Create: `src/lib/metadata-writer.ts`, `tests/lib/metadata-writer.test.ts`

TDD: Test `buildMetadataDiffs` (detects title/artist/album differences, empty when matching, artwork diff). Implement `writeTagsToMp3` (via node-id3), `writeTagsToFlac` (via metaflac CLI), `writeTags` (format dispatcher).

---

## Task 12: Soulseek Client Wrapper

**Files:**
- Create: `src/lib/soulseek-client.ts`

No unit tests (requires live Soulseek connection). Implement promise wrappers around callback-based `slsk-client`: `connectSoulseek`, `searchSoulseek` (filter to audio files, sort by quality), `downloadFromSoulseek`. Auto-reconnect, 15s search timeout.

---

## Task 13: API Routes — Scan & Settings

**Files:**
- Create: `src/app/api/scan/route.ts`, `src/app/api/scan/progress/route.ts`, `src/app/api/scan/stats/route.ts`, `src/app/api/settings/route.ts`

POST `/api/scan` triggers library scan (mutex to prevent concurrent). GET `/api/scan/progress` SSE stream. GET `/api/scan/stats` returns counts from SQLite. GET/PUT `/api/settings` for key-value config.

---

## Task 14: API Routes — Spotify

**Files:**
- Create: `src/app/api/spotify/auth/route.ts`, `src/app/api/spotify/callback/route.ts`, `src/app/api/spotify/sync/route.ts`, `src/app/api/spotify/like/route.ts`, `src/app/api/spotify/status/route.ts`

Auth initiation (builds PKCE URL), callback (exchanges code for tokens), sync (fetches all liked tracks, upserts to DB), like (batch PUT to Spotify), status (connection check).

---

## Task 15: API Routes — Match, Duplicates, Metadata, Soulseek, Backup

**Files:**
- Create: All remaining API route files

Match: run matching engine, get results (with filters: probable, confirmed, missing_locally, missing_on_spotify), confirm/reject. Duplicates: detect + get groups, resolve. Metadata: get diffs, apply changes. Soulseek: connect, search, download, queue status. Backup: status, sync, history.

---

## Task 16: UI Shell — Layout & Navigation

**Files:**
- Create: `src/components/layout/sidebar.tsx`
- Modify: `src/app/layout.tsx`

Dark theme sidebar with nav links to all 7 pages. Root layout wraps content with sidebar + Toaster.

---

## Task 17: Dashboard Home Page

**Files:**
- Modify: `src/app/page.tsx`

Stat cards (local tracks, matched, Spotify liked, duplicates), last scan time, action buttons (Scan Library, Sync Spotify, Check for Duplicates).

---

## Task 18: Missing Locally Page + Soulseek Search Panel

**Files:**
- Create: `src/app/missing-locally/page.tsx`, `src/components/soulseek/search-panel.tsx`

Track list with album art, per-track "Search Soulseek" button opens inline search panel. Panel shows results with format/bitrate/size, download button per result.

---

## Task 19: Missing on Spotify Page

**Files:**
- Create: `src/app/missing-on-spotify/page.tsx`

Track list with checkboxes, "Like Selected" bulk action. Tracks not found on Spotify flagged with badge.

---

## Task 20: Metadata Manager Page

**Files:**
- Create: `src/app/metadata/page.tsx`, `src/components/metadata/diff-table.tsx`

Table with checkboxes showing field, local value (red), Spotify value (green). Select all + apply selected.

---

## Task 21: Duplicates Page

**Files:**
- Create: `src/app/duplicates/page.tsx`, `src/components/duplicates/duplicate-card.tsx`

Cards per duplicate group. Each member shows path, format, bitrate, size, quality score. Recommended copy highlighted. Keep Best / Keep This / Keep All actions.

---

## Task 22: Backup Page

**Files:**
- Create: `src/app/backup/page.tsx`

Stat cards (source files, up to date, pending), progress bar, Sync Now button, pending files list.

---

## Task 23: Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`

Spotify connection status + connect button. Path inputs (source, backup, trash). File template input. Soulseek credentials. Save button.

---

## Task 24: Missing Locally / Missing on Spotify Query Filters

**Files:**
- Modify: `src/app/api/match/results/route.ts`

Add `missing_locally` filter (Spotify tracks with no confirmed match) and `missing_on_spotify` filter (local tracks with no confirmed match).

---

## Task 25: Final Build & Smoke Test

- [ ] Run all tests: `npm test`
- [ ] Build: `npm run build`
- [ ] Start dev server, verify all 7 pages render correctly
- [ ] Commit any fixes

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | package.json, next.config.ts, types |
| 2 | Database layer | db.ts, settings.ts |
| 3 | String normalization | normalize.ts |
| 4 | Library scanner | scanner.ts, event-bus.ts |
| 5 | File organizer | file-organizer.ts |
| 6 | Spotify PKCE auth | spotify-auth.ts |
| 7 | Spotify API client | spotify-client.ts |
| 8 | Matching engine | matcher.ts |
| 9 | Duplicate detector | duplicate-detector.ts |
| 10 | Backup sync | backup-sync.ts |
| 11 | Metadata writer | metadata-writer.ts |
| 12 | Soulseek client | soulseek-client.ts |
| 13-15 | API routes | api/*/ |
| 16 | UI shell + sidebar | layout.tsx, sidebar.tsx |
| 17-23 | Dashboard pages | app/*/page.tsx |
| 24 | Query filters | api/match/results/ |
| 25 | Final build + smoke test | — |
