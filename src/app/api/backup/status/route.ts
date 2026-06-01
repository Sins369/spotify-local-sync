import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { isBackupRunning } from "@/lib/backup-sync";

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

    // Use last successful backup to estimate backed-up count
    const lastBackup = db.prepare(
      "SELECT files_synced, files_failed FROM backup_history WHERE status IN ('complete', 'partial') ORDER BY created_at DESC LIMIT 1"
    ).get() as { files_synced: number; files_failed: number } | undefined;

    const backedUp = lastBackup ? totalFiles - (lastBackup.files_failed ?? 0) : 0;
    const upToDate = Math.min(Math.max(0, backedUp), totalFiles);
    const pending = totalFiles - upToDate;

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
