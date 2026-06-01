import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { detectChanges, copyFile } from "@/lib/backup-sync";

const SRC_DIR = path.join(__dirname, "../fixtures/backup-src");
const DEST_DIR = path.join(__dirname, "../fixtures/backup-dest");

describe("detectChanges", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(SRC_DIR, "Artist"), { recursive: true });
    fs.mkdirSync(DEST_DIR, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(SRC_DIR, { recursive: true, force: true });
    fs.rmSync(DEST_DIR, { recursive: true, force: true });
  });

  it("detects new files", async () => {
    fs.writeFileSync(path.join(SRC_DIR, "Artist", "song.mp3"), "data");
    const changes = await detectChanges([path.join(SRC_DIR, "Artist", "song.mp3")], SRC_DIR, DEST_DIR);
    expect(changes.toCopy).toHaveLength(1);
    expect(changes.toCopy[0].reason).toBe("new");
  });
  it("detects modified files", async () => {
    const srcFile = path.join(SRC_DIR, "Artist", "song.mp3");
    const destFile = path.join(DEST_DIR, "Artist", "song.mp3");
    fs.mkdirSync(path.join(DEST_DIR, "Artist"), { recursive: true });
    fs.writeFileSync(srcFile, "original");
    fs.writeFileSync(destFile, "original");
    fs.writeFileSync(srcFile, "modified data");
    const changes = await detectChanges([srcFile], SRC_DIR, DEST_DIR);
    expect(changes.toCopy).toHaveLength(1);
    expect(changes.toCopy[0].reason).toBe("modified");
  });
  it("skips unchanged files", async () => {
    const srcFile = path.join(SRC_DIR, "Artist", "song.mp3");
    const destFile = path.join(DEST_DIR, "Artist", "song.mp3");
    fs.mkdirSync(path.join(DEST_DIR, "Artist"), { recursive: true });
    fs.writeFileSync(srcFile, "same data");
    fs.writeFileSync(destFile, "same data");
    fs.utimesSync(destFile, fs.statSync(srcFile).atime, fs.statSync(srcFile).mtime);
    const changes = await detectChanges([srcFile], SRC_DIR, DEST_DIR);
    expect(changes.toCopy).toHaveLength(0);
  });
});

describe("copyFile", () => {
  beforeEach(() => {
    fs.mkdirSync(SRC_DIR, { recursive: true });
    fs.mkdirSync(DEST_DIR, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(SRC_DIR, { recursive: true, force: true });
    fs.rmSync(DEST_DIR, { recursive: true, force: true });
  });

  it("copies file preserving directory structure", async () => {
    fs.writeFileSync(path.join(SRC_DIR, "song.mp3"), "audio data");
    await copyFile(path.join(SRC_DIR, "song.mp3"), path.join(DEST_DIR, "song.mp3"));
    expect(fs.readFileSync(path.join(DEST_DIR, "song.mp3"), "utf-8")).toBe("audio data");
  });
  it("creates destination directories", async () => {
    fs.writeFileSync(path.join(SRC_DIR, "song.mp3"), "audio data");
    await copyFile(path.join(SRC_DIR, "song.mp3"), path.join(DEST_DIR, "Artist", "Album", "song.mp3"));
    expect(fs.existsSync(path.join(DEST_DIR, "Artist", "Album", "song.mp3"))).toBe(true);
  });
});
