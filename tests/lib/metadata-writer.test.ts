import { describe, it, expect } from "vitest";
import { buildMetadataDiffs } from "@/lib/metadata-writer";

describe("buildMetadataDiffs", () => {
  it("detects title differences", () => {
    const diffs = buildMetadataDiffs(
      { id: 1, title: "Bohemain Rhapsody", artist: "Queen", album: "A Night at the Opera", path: "/test.mp3" },
      { id: 10, title: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", album_art_url: null }
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe("title");
    expect(diffs[0].local_value).toBe("Bohemain Rhapsody");
    expect(diffs[0].spotify_value).toBe("Bohemian Rhapsody");
  });
  it("detects multiple differences", () => {
    const diffs = buildMetadataDiffs(
      { id: 1, title: "Song", artist: "Arist", album: "Ablum", path: "/test.mp3" },
      { id: 10, title: "Song", artist: "Artist", album: "Album", album_art_url: null }
    );
    expect(diffs).toHaveLength(2);
    expect(diffs.map((d) => d.field).sort()).toEqual(["album", "artist"]);
  });
  it("returns empty array when metadata matches", () => {
    const diffs = buildMetadataDiffs(
      { id: 1, title: "Song", artist: "Artist", album: "Album", path: "/test.mp3" },
      { id: 10, title: "Song", artist: "Artist", album: "Album", album_art_url: null }
    );
    expect(diffs).toHaveLength(0);
  });
  it("detects missing artwork as a diff when spotify has it", () => {
    const diffs = buildMetadataDiffs(
      { id: 1, title: "Song", artist: "Artist", album: "Album", path: "/test.mp3", has_artwork: false },
      { id: 10, title: "Song", artist: "Artist", album: "Album", album_art_url: "https://example.com/art.jpg" }
    );
    expect(diffs.find((d) => d.field === "artwork")).toBeDefined();
  });
});
