import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { discoverFiles, extractMetadata } from "@/lib/scanner";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scan-test");

describe("discoverFiles", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(FIXTURES_DIR, "Artist", "Album"), { recursive: true });
    fs.writeFileSync(path.join(FIXTURES_DIR, "Artist", "Album", "song.mp3"), "fake");
    fs.writeFileSync(path.join(FIXTURES_DIR, "Artist", "Album", "song.flac"), "fake");
    fs.writeFileSync(path.join(FIXTURES_DIR, "Artist", "Album", "cover.jpg"), "fake");
    fs.writeFileSync(path.join(FIXTURES_DIR, "notes.txt"), "fake");
  });
  afterEach(() => { fs.rmSync(FIXTURES_DIR, { recursive: true, force: true }); });

  it("finds only audio files recursively", async () => {
    const files = await discoverFiles(FIXTURES_DIR);
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith(".mp3") || f.endsWith(".flac"))).toBe(true);
  });
  it("returns absolute paths", async () => {
    const files = await discoverFiles(FIXTURES_DIR);
    expect(files.every((f) => path.isAbsolute(f))).toBe(true);
  });
});

describe("extractMetadata", () => {
  it("returns null fields for a fake file", async () => {
    const fakeFile = path.join(__dirname, "../fixtures/fake.mp3");
    fs.writeFileSync(fakeFile, "not a real mp3");
    try {
      const meta = await extractMetadata(fakeFile);
      expect(meta).toHaveProperty("path", fakeFile);
      expect(meta.title).toBeNull();
    } finally {
      fs.unlinkSync(fakeFile);
    }
  });
});
