import { getDb } from "./db";
import { getSetting } from "./settings";
import { searchSoulseek, connectSoulseek, isConnected } from "./soulseek-client";
import { startDownloadWorker } from "./download-worker";
import { eventBus } from "./event-bus";
import path from "path";
import type { SoulseekResult } from "@/types";

/* ------------------------------------------------------------------ */
/*  Global state                                                      */
/* ------------------------------------------------------------------ */

interface BulkState {
  running: boolean;
  cancelled: boolean;
  paused: boolean;
  searched: number;
  queued: number;
  noResults: number;
  total: number;
}

const globalForBulk = globalThis as unknown as { __bulkState: BulkState | null };

export function getBulkState(): BulkState | null {
  return globalForBulk.__bulkState ?? null;
}

export function cancelBulk(): void {
  if (globalForBulk.__bulkState) {
    globalForBulk.__bulkState.cancelled = true;
  }
}

export function pauseBulk(): void {
  if (globalForBulk.__bulkState) {
    globalForBulk.__bulkState.paused = !globalForBulk.__bulkState.paused;
  }
}

export function isBulkRunning(): boolean {
  return globalForBulk.__bulkState?.running === true;
}

/* ------------------------------------------------------------------ */
/*  Source picker                                                     */
/* ------------------------------------------------------------------ */

type QualityPref = "flac" | "mp3" | "any";

const FORMAT_RANK: Record<string, number> = { flac: 0, wav: 1, m4a: 2, mp3: 3, ogg: 4, opus: 5 };

export function pickSource(
  results: SoulseekResult[],
  qualityPref: QualityPref,
): SoulseekResult | null {
  // Filter out tiny files (likely corrupt)
  const viable = results.filter((r) => r.size >= 500_000);
  if (viable.length === 0) return null;

  // Sort: prefer users with free slots, then by format/bitrate depending on pref
  const sorted = [...viable].sort((a, b) => {
    const aFree = a.queueLength === 0 ? 0 : 1;
    const bFree = b.queueLength === 0 ? 0 : 1;
    if (aFree !== bFree) return aFree - bFree;
    return 0;
  });

  if (qualityPref === "flac") {
    // Prefer FLAC, fall back to highest bitrate of anything else
    const flac = sorted.find((r) => r.format === "flac");
    if (flac) return flac;
    // Fall back: highest bitrate non-FLAC
    return pickHighestBitrate(sorted);
  }

  if (qualityPref === "mp3") {
    // MP3 only, highest bitrate — return null if no MP3 available
    const mp3s = sorted.filter((r) => r.format === "mp3");
    return pickHighestBitrate(mp3s);
  }

  // qualityPref === "any": best available (FLAC > WAV > M4A > MP3), sorted by bitrate
  sorted.sort((a, b) => {
    const aFree = a.queueLength === 0 ? 0 : 1;
    const bFree = b.queueLength === 0 ? 0 : 1;
    if (aFree !== bFree) return aFree - bFree;
    const fa = FORMAT_RANK[a.format] ?? 99;
    const fb = FORMAT_RANK[b.format] ?? 99;
    if (fa !== fb) return fa - fb;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });
  return sorted[0] ?? null;
}

function pickHighestBitrate(sources: SoulseekResult[]): SoulseekResult | null {
  if (sources.length === 0) return null;
  return sources.reduce((best, cur) =>
    (cur.bitrate ?? 0) > (best.bitrate ?? 0) ? cur : best,
  );
}

/* ------------------------------------------------------------------ */
/*  Soulseek connection helper                                        */
/* ------------------------------------------------------------------ */

async function ensureConnected(): Promise<boolean> {
  if (isConnected()) return true;
  const username = getSetting("soulseek_username");
  const password = getSetting("soulseek_password");
  if (!username || !password) return false;
  const shareLibrary = getSetting("soulseek_share_library") === "true";
  const musicPath = getSetting("music_source_path");
  const sharedFolders = shareLibrary && musicPath ? [musicPath] : [];
  try {
    await Promise.race([
      connectSoulseek(username, password, sharedFolders),
      sleep(10000).then(() => { throw new Error("timeout"); }),
    ]);
    return true;
  } catch { return false; }
}

/* ------------------------------------------------------------------ */
/*  Main pipeline                                                     */
/* ------------------------------------------------------------------ */

const MAX_RETRY_ROUNDS = 2;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const SEARCH_THROTTLE_MS = 500;

export async function runBulkDownload(
  trackIds: number[],
  qualityPref: QualityPref,
): Promise<void> {
  // Don't allow concurrent bulk runs
  if (isBulkRunning()) return;

  const state: BulkState = {
    running: true,
    cancelled: false,
    paused: false,
    searched: 0,
    queued: 0,
    noResults: 0,
    total: trackIds.length,
  };
  globalForBulk.__bulkState = state;

  try {
    // Connect to Soulseek
    const connected = await ensureConnected();
    if (!connected) {
      eventBus.emit("bulk:done", { completed: 0, unavailable: state.total, total: state.total });
      return;
    }

    const db = getDb();
    const retryPool: number[] = [];

    // Main pass
    for (const trackId of trackIds) {
      if (state.cancelled) break;

      // Respect pause
      while (state.paused && !state.cancelled) {
        await sleep(500);
      }
      if (state.cancelled) break;

      // Skip if already has any download (including failed)
      const existingDownload = db.prepare(
        "SELECT id FROM downloads WHERE spotify_track_id = ?"
      ).get(trackId) as { id: number } | undefined;
      if (existingDownload) {
        state.searched++;
        emitProgress(state);
        continue;
      }

      // Fetch track info from DB
      const track = db.prepare(
        "SELECT id, title, artist FROM spotify_tracks WHERE id = ?"
      ).get(trackId) as { id: number; title: string | null; artist: string | null } | undefined;
      if (!track || !track.title || !track.artist) {
        state.searched++;
        state.noResults++;
        emitProgress(state);
        continue;
      }

      eventBus.emit("bulk:searching", { trackId, searched: state.searched, total: state.total });

      const firstArtist = track.artist.split(",")[0].trim();
      const source = await searchWithVariations(track.title, firstArtist, qualityPref);

      state.searched++;

      if (source) {
        const filename = path.basename(source.file);
        db.prepare(
          "INSERT INTO downloads (spotify_track_id, status, source_user, source_file, filename, file_size, format, bitrate) VALUES (?, 'queued', ?, ?, ?, ?, ?, ?)"
        ).run(trackId, source.username, source.file, filename, source.size, source.format, source.bitrate);

        state.queued++;
        startDownloadWorker();
        eventBus.emit("bulk:queued", { trackId, source: source.username, format: source.format });
      } else {
        state.noResults++;
        retryPool.push(trackId);
        eventBus.emit("bulk:no_results", { trackId, retryLater: true });
      }

      emitProgress(state);
      await sleep(SEARCH_THROTTLE_MS);
    }

    // Retry rounds
    if (!state.cancelled && retryPool.length > 0) {
      for (let round = 0; round < MAX_RETRY_ROUNDS; round++) {
        if (state.cancelled || retryPool.length === 0) break;

        await sleep(RETRY_DELAY_MS);
        if (state.cancelled) break;

        // Re-check connection before retry round
        const stillConnected = await ensureConnected();
        if (!stillConnected) break;

        const remaining = [...retryPool];
        retryPool.length = 0;

        for (const trackId of remaining) {
          if (state.cancelled) break;

          while (state.paused && !state.cancelled) {
            await sleep(500);
          }
          if (state.cancelled) break;

          const track = db.prepare(
            "SELECT id, title, artist FROM spotify_tracks WHERE id = ?"
          ).get(trackId) as { id: number; title: string | null; artist: string | null } | undefined;
          if (!track || !track.title || !track.artist) continue;

          eventBus.emit("bulk:searching", { trackId, searched: state.searched, total: state.total });

          const firstArtist = track.artist.split(",")[0].trim();
          const source = await searchWithVariations(track.title, firstArtist, qualityPref);

          if (source) {
            const filename = path.basename(source.file);
            db.prepare(
              "INSERT INTO downloads (spotify_track_id, status, source_user, source_file, filename, file_size, format, bitrate) VALUES (?, 'queued', ?, ?, ?, ?, ?, ?)"
            ).run(trackId, source.username, source.file, filename, source.size, source.format, source.bitrate);

            state.queued++;
            state.noResults--;
            startDownloadWorker();
            eventBus.emit("bulk:queued", { trackId, source: source.username, format: source.format });
          } else {
            retryPool.push(trackId);
          }

          emitProgress(state);
          await sleep(SEARCH_THROTTLE_MS);
        }
      }
    }

    // Final event
    const unavailable = state.total - state.queued;
    eventBus.emit("bulk:done", {
      completed: state.queued,
      unavailable,
      total: state.total,
    });
  } finally {
    state.running = false;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function searchWithVariations(
  title: string,
  firstArtist: string,
  qualityPref: QualityPref,
): Promise<SoulseekResult | null> {
  // Try first query — skip second if good results found
  try {
    const results = await searchSoulseek(`${firstArtist} ${title}`);
    const pick = pickSource(results, qualityPref);
    if (pick) return pick;
  } catch {}

  // Fallback: reversed query
  try {
    const results = await searchSoulseek(`${title} ${firstArtist}`);
    return pickSource(results, qualityPref);
  } catch {}

  return null;
}

function emitProgress(state: BulkState): void {
  eventBus.emit("bulk:progress", {
    searched: state.searched,
    queued: state.queued,
    noResults: state.noResults,
    total: state.total,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
