import { normalizeForKey } from "./normalize";
import type { LocalTrack } from "@/types";

const EXACT_DURATION_THRESHOLD_MS = 5000;
const LOOSE_DURATION_THRESHOLD_MS = 60000;
const MIN_ISRC_LENGTH = 8;

const FORMAT_SCORES: Record<string, number> = {
  flac: 100,
  wav: 95,
  aiff: 90,
  alac: 85,
  ogg: 65,
  m4a: 60,
  mp3: 50,
  mpeg: 50,
  aac: 55,
  wma: 40,
};

export interface DuplicateGroupResult {
  key: string;
  members: LocalTrack[];
}

export function findDuplicateGroups(tracks: LocalTrack[]): DuplicateGroupResult[] {
  const seenTrackIds = new Set<number>();
  const results: DuplicateGroupResult[] = [];

  // Pass 1: ISRC-based grouping (same recording, always a duplicate)
  const isrcMap = new Map<string, LocalTrack[]>();
  for (const track of tracks) {
    if (!track.isrc || track.isrc.length < MIN_ISRC_LENGTH) continue;
    const isrc = track.isrc.toUpperCase();
    const existing = isrcMap.get(isrc);
    if (existing) existing.push(track);
    else isrcMap.set(isrc, [track]);
  }

  for (const [isrc, group] of isrcMap) {
    if (group.length < 2) continue;
    results.push({ key: `isrc:${isrc}`, members: group });
    group.forEach(t => seenTrackIds.add(t.id));
  }

  // Pass 2: Title+artist grouping with duration matching
  const keyMap = new Map<string, LocalTrack[]>();
  for (const track of tracks) {
    if (!track.title || !track.artist) continue;
    if (seenTrackIds.has(track.id)) continue;
    const key = normalizeForKey(track.title, track.artist);
    const existing = keyMap.get(key);
    if (existing) existing.push(track);
    else keyMap.set(key, [track]);
  }

  for (const [key, group] of keyMap) {
    if (group.length < 2) continue;

    // Exact duration matches first (definite duplicates)
    const exactGroups = subGroupByDuration(group, EXACT_DURATION_THRESHOLD_MS);
    for (const subGroup of exactGroups) {
      if (subGroup.length >= 2) {
        results.push({ key, members: subGroup });
        subGroup.forEach(t => seenTrackIds.add(t.id));
      }
    }

    // Remaining: same title+artist but different durations (likely remixes/edits)
    const remaining = group.filter(t => !seenTrackIds.has(t.id));
    if (remaining.length >= 2) {
      const looseGroups = subGroupByDuration(remaining, LOOSE_DURATION_THRESHOLD_MS);
      for (const subGroup of looseGroups) {
        if (subGroup.length >= 2) {
          results.push({ key: `review:${key}`, members: subGroup });
          subGroup.forEach(t => seenTrackIds.add(t.id));
        }
      }
    }
  }

  return results;
}

function subGroupByDuration(tracks: LocalTrack[], threshold: number): LocalTrack[][] {
  const groups: LocalTrack[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < tracks.length; i++) {
    if (used.has(i)) continue;

    const cluster: LocalTrack[] = [tracks[i]];
    used.add(i);

    for (let j = i + 1; j < tracks.length; j++) {
      if (used.has(j)) continue;

      const durationA = tracks[i].duration_ms ?? 0;
      const durationB = tracks[j].duration_ms ?? 0;

      if (Math.abs(durationA - durationB) <= threshold) {
        cluster.push(tracks[j]);
        used.add(j);
      }
    }

    groups.push(cluster);
  }

  return groups;
}

export function scoreTrackQuality(track: LocalTrack): number {
  let score = 0;

  // Format score
  const format = (track.format ?? "").toLowerCase();
  score += FORMAT_SCORES[format] ?? 30;

  // Bitrate score: normalize to kbps first (raw value may be bps), then /10, capped at 50
  const rawBitrate = track.bitrate ?? 0;
  const kbps = rawBitrate > 10000 ? rawBitrate / 1000 : rawBitrate;
  const bitrateScore = Math.min(kbps / 10, 50);
  score += bitrateScore;

  // Artwork bonus
  if (track.has_artwork) {
    score += 10;
  }

  // Metadata completeness: 2 per field
  const metadataFields: (keyof LocalTrack)[] = [
    "title", "artist", "album", "album_artist",
    "track_no", "disc_no", "year", "genre", "isrc",
  ];
  for (const field of metadataFields) {
    if (track[field] != null && track[field] !== "") {
      score += 2;
    }
  }

  return score;
}
