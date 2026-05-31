import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { getDb, closeDb } from "@/lib/db";
import { getSetting, setSetting, getAllSettings } from "@/lib/settings";

const TEST_DB_PATH = path.join(__dirname, "../fixtures/test.db");

describe("db", () => {
  beforeEach(() => {
    process.env.DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it("creates database with all tables", () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("local_tracks");
    expect(tableNames).toContain("spotify_tracks");
    expect(tableNames).toContain("matches");
    expect(tableNames).toContain("duplicate_groups");
    expect(tableNames).toContain("duplicate_members");
    expect(tableNames).toContain("downloads");
    expect(tableNames).toContain("backup_state");
    expect(tableNames).toContain("settings");
  });

  it("enables WAL mode", () => {
    const db = getDb();
    const result = db.prepare("PRAGMA journal_mode").get() as {
      journal_mode: string;
    };
    expect(result.journal_mode).toBe("wal");
  });

  it("returns the same instance on multiple calls", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});

describe("settings", () => {
  beforeEach(() => {
    process.env.DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it("sets and gets a setting", () => {
    setSetting("music_source_path", "\\\\MAIN-PC\\Music");
    expect(getSetting("music_source_path")).toBe("\\\\MAIN-PC\\Music");
  });

  it("returns null for missing setting", () => {
    expect(getSetting("nonexistent")).toBeNull();
  });

  it("overwrites existing setting", () => {
    setSetting("music_source_path", "/old/path");
    setSetting("music_source_path", "/new/path");
    expect(getSetting("music_source_path")).toBe("/new/path");
  });

  it("returns all settings", () => {
    setSetting("key1", "val1");
    setSetting("key2", "val2");
    const all = getAllSettings();
    expect(all).toEqual({ key1: "val1", key2: "val2" });
  });
});
