import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { discoverFiles } from "@/lib/scanner";
import { runBackupSync, cancelBackup, isBackupRunning } from "@/lib/backup-sync";

export async function POST() {
  try {
    if (isBackupRunning()) {
      return NextResponse.json({ error: "Backup already in progress" }, { status: 409 });
    }

    const sourcePath = getSetting("music_source_path");
    const backupPath = getSetting("backup_dest_path");

    if (!sourcePath || !backupPath) {
      return NextResponse.json(
        { error: "Source and backup paths not configured" },
        { status: 400 }
      );
    }

    const sourceFiles = await discoverFiles(sourcePath);

    // Fire and forget — don't await
    runBackupSync(sourceFiles, sourcePath, backupPath).catch(() => {});

    return NextResponse.json({
      started: true,
      total_files: sourceFiles.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Backup sync failed",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  cancelBackup();
  return NextResponse.json({ cancelled: true });
}
