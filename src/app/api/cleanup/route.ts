import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import fs from "fs";
import path from "path";

export async function POST() {
  try {
    const db = getDb();
    const sourcePath = getSetting("music_source_path");

    let staleRemoved = 0;
    let emptyFoldersRemoved = 0;

    // 1. Remove DB entries for files that no longer exist
    const allTracks = db.prepare("SELECT id, path FROM local_tracks").all() as Array<{
      id: number;
      path: string;
    }>;

    const deleteTrack = db.prepare("DELETE FROM local_tracks WHERE id = ?");
    const deleteMatchByLocal = db.prepare("DELETE FROM matches WHERE local_track_id = ?");
    const deleteDupMember = db.prepare("DELETE FROM duplicate_members WHERE local_track_id = ?");

    const removeStale = db.transaction((staleIds: number[]) => {
      for (const id of staleIds) {
        deleteMatchByLocal.run(id);
        deleteDupMember.run(id);
        deleteTrack.run(id);
      }
    });

    const staleIds: number[] = [];
    for (const track of allTracks) {
      if (!fs.existsSync(track.path)) {
        staleIds.push(track.id);
      }
    }

    if (staleIds.length > 0) {
      removeStale(staleIds);
      staleRemoved = staleIds.length;
    }

    // Clean up orphaned duplicate groups
    db.prepare("DELETE FROM duplicate_groups WHERE id NOT IN (SELECT DISTINCT group_id FROM duplicate_members)").run();

    // 2. Remove empty folders from music source
    if (sourcePath && fs.existsSync(sourcePath)) {
      emptyFoldersRemoved = removeEmptyFolders(sourcePath, sourcePath);
    }

    return NextResponse.json({
      stale_records_removed: staleRemoved,
      empty_folders_removed: emptyFoldersRemoved,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

function removeEmptyFolders(dirPath: string, rootPath: string): number {
  let removed = 0;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      removed += removeEmptyFolders(path.join(dirPath, entry.name), rootPath);
    }
  }

  // Re-read after recursive cleanup
  try {
    const remaining = fs.readdirSync(dirPath);
    if (remaining.length === 0 && dirPath !== rootPath) {
      fs.rmdirSync(dirPath);
      removed++;
    }
  } catch {
    // skip
  }

  return removed;
}

export async function GET() {
  try {
    const db = getDb();
    const sourcePath = getSetting("music_source_path");

    const allTracks = db.prepare("SELECT path FROM local_tracks").all() as Array<{ path: string }>;
    let staleCount = 0;
    for (const track of allTracks) {
      if (!fs.existsSync(track.path)) {
        staleCount++;
      }
    }

    let emptyFolderCount = 0;
    if (sourcePath && fs.existsSync(sourcePath)) {
      emptyFolderCount = countEmptyFolders(sourcePath);
    }

    return NextResponse.json({
      stale_records: staleCount,
      empty_folders: emptyFolderCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check failed" },
      { status: 500 }
    );
  }
}

function countEmptyFolders(dirPath: string): number {
  let count = 0;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  const dirs = entries.filter((e) => e.isDirectory());
  const files = entries.filter((e) => e.isFile());

  if (dirs.length === 0 && files.length === 0) {
    return 1;
  }

  for (const dir of dirs) {
    count += countEmptyFolders(path.join(dirPath, dir.name));
  }

  return count;
}
