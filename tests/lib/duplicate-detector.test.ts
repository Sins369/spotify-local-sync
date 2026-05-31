import { describe, it, expect } from "vitest";
import { findDuplicateGroups, scoreTrackQuality } from "@/lib/duplicate-detector";
import type { LocalTrack } from "@/types";

const makeTrack = (overrides: Partial<LocalTrack>): LocalTrack => ({
  id: 1, path: "/music/song.mp3", size: 5000000, mtime_ms: Date.now(),
  title: "Song", artist: "Artist", album_artist: null, album: "Album",
  track_no: 1, disc_no: 1, year: 2020, genre: "Rock", duration_ms: 240000,
  isrc: null, format: "mp3", bitrate: 320, has_artwork: 1,
  scanned_at: new Date().toISOString(), ...overrides,
});

describe("findDuplicateGroups", () => {
  it("groups tracks with same title and artist", () => {
    const tracks = [
      makeTrack({ id: 1, path: "/a/song.mp3", duration_ms: 240000 }),
      makeTrack({ id: 2, path: "/b/song.mp3", duration_ms: 241000 }),
      makeTrack({ id: 3, path: "/c/other.mp3", title: "Other Song", duration_ms: 180000 }),
    ];
    const groups = findDuplicateGroups(tracks);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
  it("does not group tracks with different duration beyond threshold", () => {
    const tracks = [
      makeTrack({ id: 1, duration_ms: 240000 }),
      makeTrack({ id: 2, duration_ms: 300000 }),
    ];
    expect(findDuplicateGroups(tracks)).toHaveLength(0);
  });
  it("handles remastered vs original as near-duplicates", () => {
    const tracks = [
      makeTrack({ id: 1, title: "Song", duration_ms: 240000 }),
      makeTrack({ id: 2, title: "Song (Remastered)", duration_ms: 241000 }),
    ];
    expect(findDuplicateGroups(tracks)).toHaveLength(1);
  });
});

describe("scoreTrackQuality", () => {
  it("scores FLAC higher than MP3", () => {
    expect(scoreTrackQuality(makeTrack({ format: "flac", bitrate: 1000 }))).toBeGreaterThan(
      scoreTrackQuality(makeTrack({ format: "mp3", bitrate: 320 }))
    );
  });
  it("scores higher bitrate higher", () => {
    expect(scoreTrackQuality(makeTrack({ bitrate: 320 }))).toBeGreaterThan(
      scoreTrackQuality(makeTrack({ bitrate: 128 }))
    );
  });
  it("scores tracks with artwork higher", () => {
    expect(scoreTrackQuality(makeTrack({ has_artwork: 1 }))).toBeGreaterThan(
      scoreTrackQuality(makeTrack({ has_artwork: 0 }))
    );
  });
});
