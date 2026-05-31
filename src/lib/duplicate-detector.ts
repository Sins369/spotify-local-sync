import { normalizeForKey } from "./normalize";
import type { LocalTrack } from "@/types";

const DURATION_THRESHOLD_MS = 5000;

const FORMAT_SCORES: Record<string, number> = {
  flac: 100,
  wav: 95,
  aiff: 90,
  alac: 85,
  ogg: 65,
  m4a: 60,
  mp3: 50,
  aac: 55,
  wma: 40,
};

export interface DuplicateGroupResult {
  key: string;
  members: LocalTrack[];
}

export function findDuplicateGroups(tracks: LocalTrack[]): DuplicateGroupResult[] {
  // Group by normalized title+artist key
  const keyMap = new Map<string, LocalTrack[]>();

  for (const track of tracks) {
    if (!track.title || !track.artist) continue;
    const key = normalizeForKey(track.title, track.artist);
    const existing = keyMap.get(key);
    if (existing) {
      existing.push(track);
    } else {
      keyMap.set(key, [track]);
    }
  }

  const results: DuplicateGroupResult[] = [];

  for (const [key, group] of keyMap) {
    if (group.length < 2) continue;

    // Sub-group by duration within threshold
    const subGroups = subGroupByDuration(group);

    for (const subGroup of subGroups) {
      if (subGroup.length >= 2) {
        results.push({ key, members: subGroup });
      }
    }
  }

  return results;
}

function subGroupByDuration(tracks: LocalTrack[]): LocalTrack[][] {
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

      if (Math.abs(durationA - durationB) <= DURATION_THRESHOLD_MS) {
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

  // Bitrate score: bitrate / 10, capped at 50
  const bitrateScore = Math.min((track.bitrate ?? 0) / 10, 50);
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
