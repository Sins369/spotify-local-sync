import { describe, it, expect } from "vitest";
import { scoreMatch, classifyConfidence } from "@/lib/matcher";

describe("scoreMatch", () => {
  it("returns high score for exact match", () => {
    const score = scoreMatch(
      { title: "Bohemian Rhapsody", artist: "Queen", duration_ms: 354000 },
      { title: "Bohemian Rhapsody", artist: "Queen", duration_ms: 354000 }
    );
    expect(score).toBeGreaterThan(0.95);
  });
  it("returns high score for similar titles with different casing", () => {
    const score = scoreMatch(
      { title: "bohemian rhapsody", artist: "queen", duration_ms: 354000 },
      { title: "Bohemian Rhapsody", artist: "Queen", duration_ms: 354000 }
    );
    expect(score).toBeGreaterThan(0.95);
  });
  it("returns lower score for different duration", () => {
    const exact = scoreMatch(
      { title: "Song", artist: "Artist", duration_ms: 200000 },
      { title: "Song", artist: "Artist", duration_ms: 200000 }
    );
    const different = scoreMatch(
      { title: "Song", artist: "Artist", duration_ms: 200000 },
      { title: "Song", artist: "Artist", duration_ms: 220000 }
    );
    expect(different).toBeLessThan(exact);
  });
  it("penalizes heavily for very different duration", () => {
    const score = scoreMatch(
      { title: "Song", artist: "Artist", duration_ms: 200000 },
      { title: "Song", artist: "Artist", duration_ms: 400000 }
    );
    expect(score).toBeLessThan(0.7);
  });
  it("handles remastered suffixes", () => {
    const score = scoreMatch(
      { title: "Bohemian Rhapsody (Remastered)", artist: "Queen", duration_ms: 354000 },
      { title: "Bohemian Rhapsody", artist: "Queen", duration_ms: 355000 }
    );
    expect(score).toBeGreaterThan(0.9);
  });
});

describe("classifyConfidence", () => {
  it("returns confirmed for >0.9", () => { expect(classifyConfidence(0.95)).toBe("confirmed"); });
  it("returns probable for 0.7-0.9", () => { expect(classifyConfidence(0.8)).toBe("probable"); });
  it("returns no_match for <0.7", () => { expect(classifyConfidence(0.5)).toBe("no_match"); });
});
