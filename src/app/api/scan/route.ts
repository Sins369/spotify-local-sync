import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scanLibrary } from "@/lib/scanner";
import { getSetting } from "@/lib/settings";

let scanInProgress = false;

export async function POST() {
  if (scanInProgress) {
    return NextResponse.json(
      { error: "Scan already in progress" },
      { status: 409 }
    );
  }

  const sourcePath = getSetting("music_source_path");
  if (!sourcePath) {
    return NextResponse.json(
      { error: "Music source path not configured" },
      { status: 400 }
    );
  }

  scanInProgress = true;
  try {
    await scanLibrary(sourcePath, getDb());
    const db = getDb();
    const count = (db.prepare("SELECT COUNT(*) as count FROM local_tracks").get() as { count: number }).count;
    return NextResponse.json({ success: true, total_tracks: count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  } finally {
    scanInProgress = false;
  }
}
