import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { isBackupRunning } from "@/lib/backup-sync";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const sourcePath = getSetting("music_source_path");
    const backupPath = getSetting("backup_dest_path");

    if (!sourcePath || !backupPath) {
      return NextResponse.json(
        { error: "Source and backup paths not configured" },
        { status: 400 }
      );
    }

    const db = getDb();
    const totalFiles = (db.prepare("SELECT COUNT(*) as c FROM local_tracks").get() as { c: number }).c;

    // Quick estimate: count files in backup dest root to approximate up_to_date
    let backedUp = 0;
    try {
      backedUp = countFilesQuick(backupPath);
    } catch {}

    const upToDate = Math.min(backedUp, totalFiles);
    const pending = Math.max(0, totalFiles - upToDate);

    return NextResponse.json({
      total_files: totalFiles,
      files_to_copy: pending,
      up_to_date: upToDate,
      running: isBackupRunning(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to get backup status",
      },
      { status: 500 }
    );
  }
}

function countFilesQuick(dir: string, max = 10000): number {
  let count = 0;
  const stack = [dir];
  while (stack.length > 0 && count < max) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      } else if (entry.isFile()) {
        count++;
      }
    }
  }
  return count;
}
