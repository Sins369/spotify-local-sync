import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { discoverFiles } from "@/lib/scanner";
import { runBackupSync } from "@/lib/backup-sync";

export async function POST() {
  try {
    const sourcePath = getSetting("music_source_path");
    const backupPath = getSetting("backup_path");

    if (!sourcePath || !backupPath) {
      return NextResponse.json(
        { error: "Source and backup paths not configured" },
        { status: 400 }
      );
    }

    const sourceFiles = await discoverFiles(sourcePath);
    const result = await runBackupSync(sourceFiles, sourcePath, backupPath);

    return NextResponse.json({
      copied: result.copied,
      errors: result.errors,
      up_to_date: result.upToDate,
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
