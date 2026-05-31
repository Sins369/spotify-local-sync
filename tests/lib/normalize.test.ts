import { describe, it, expect } from "vitest";
import { normalizeTitle, normalizeArtist, normalizeForKey } from "@/lib/normalize";

describe("normalizeTitle", () => {
  it("lowercases", () => {
    expect(normalizeTitle("Bohemian Rhapsody")).toBe("bohemian rhapsody");
  });
  it("strips remastered suffixes", () => {
    expect(normalizeTitle("Bohemian Rhapsody - Remastered 2011")).toBe("bohemian rhapsody");
    expect(normalizeTitle("Bohemian Rhapsody (Remastered)")).toBe("bohemian rhapsody");
    expect(normalizeTitle("Song (2023 Remaster)")).toBe("song");
  });
  it("strips feat. from title", () => {
    expect(normalizeTitle("Song (feat. Artist B)")).toBe("song");
    expect(normalizeTitle("Song (ft. Artist B)")).toBe("song");
  });
  it("strips deluxe/bonus markers", () => {
    expect(normalizeTitle("Song (Deluxe Edition)")).toBe("song");
    expect(normalizeTitle("Song (Bonus Track)")).toBe("song");
    expect(normalizeTitle("Song (Radio Edit)")).toBe("song");
  });
  it("removes punctuation", () => {
    expect(normalizeTitle("Don't Stop Me Now!")).toBe("dont stop me now");
  });
  it("collapses whitespace", () => {
    expect(normalizeTitle("  Hello   World  ")).toBe("hello world");
  });
});

describe("normalizeArtist", () => {
  it("lowercases", () => {
    expect(normalizeArtist("Queen")).toBe("queen");
  });
  it("strips featured artists", () => {
    expect(normalizeArtist("Artist A feat. Artist B")).toBe("artist a");
    expect(normalizeArtist("Artist A ft. Artist B")).toBe("artist a");
    expect(normalizeArtist("Artist A featuring Artist B")).toBe("artist a");
  });
  it("handles & and 'and'", () => {
    expect(normalizeArtist("Simon & Garfunkel")).toBe("simon garfunkel");
    expect(normalizeArtist("Simon and Garfunkel")).toBe("simon garfunkel");
  });
  it("handles 'The' prefix", () => {
    expect(normalizeArtist("The Beatles")).toBe("beatles");
  });
  it("removes punctuation", () => {
    expect(normalizeArtist("Guns N' Roses")).toBe("guns n roses");
  });
});

describe("normalizeForKey", () => {
  it("combines title and artist into a normalized key", () => {
    const key = normalizeForKey("Bohemian Rhapsody (Remastered)", "Queen");
    expect(key).toBe("bohemian rhapsody||queen");
  });
});
