import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { discoverFiles } from "@/lib/scanner";
import { detectChanges } from "@/lib/backup-sync";

export async function GET() {
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
    const changes = detectChanges(sourceFiles, sourcePath, backupPath);

    return NextResponse.json({
      total_files: sourceFiles.length,
      files_to_copy: changes.toCopy.length,
      up_to_date: changes.upToDate,
      changes: changes.toCopy.map((c) => ({
        source: c.src,
        destination: c.dest,
        reason: c.reason,
      })),
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
