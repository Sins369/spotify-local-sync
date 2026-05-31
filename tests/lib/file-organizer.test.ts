import { describe, it, expect } from "vitest";
import { renderPath } from "@/lib/file-organizer";

describe("renderPath", () => {
  const track = {
    album_artist: "Pink Floyd",
    artist: "Pink Floyd",
    album: "The Dark Side of the Moon",
    track_no: 3,
    disc_no: 1,
    title: "Time",
    year: 1973,
    ext: "flac",
  };

  it("renders default MusicBee template", () => {
    const result = renderPath("{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}", track);
    expect(result).toBe("Pink Floyd/The Dark Side of the Moon/03 Time.flac");
  });

  it("handles missing album artist by falling back to artist", () => {
    const result = renderPath("{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}", {
      ...track, album_artist: null,
    });
    expect(result).toBe("Pink Floyd/The Dark Side of the Moon/03 Time.flac");
  });

  it("pads track number to 2 digits", () => {
    const result = renderPath("{TrackNo} {Title}.{ext}", { ...track, track_no: 1 });
    expect(result).toBe("01 Time.flac");
  });

  it("sanitizes path-unsafe characters", () => {
    const result = renderPath("{Title}.{ext}", { ...track, title: 'Money: "Time"' });
    expect(result).not.toContain(":");
    expect(result).not.toContain('"');
  });

  it("handles all template variables", () => {
    const result = renderPath("{Artist} - {Year} - {DiscNo}-{TrackNo} {Title}.{ext}", track);
    expect(result).toBe("Pink Floyd - 1973 - 01-03 Time.flac");
  });

  it("uses Unknown for null fields", () => {
    const result = renderPath("{AlbumArtist}/{Album}/{TrackNo} {Title}.{ext}", {
      ...track, album_artist: null, artist: null, album: null, title: null, track_no: null,
    });
    expect(result).toBe("Unknown Artist/Unknown Album/00 Unknown Title.flac");
  });
});
