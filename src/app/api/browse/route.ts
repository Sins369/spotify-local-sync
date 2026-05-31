import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const dirPath = request.nextUrl.searchParams.get("path") || "";

  if (!dirPath) {
    const drives = getDrives();
    return NextResponse.json({ path: "", entries: drives, parent: null });
  }

  try {
    const resolved = path.resolve(dirPath);
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => ({
        name: e.name,
        path: path.join(resolved, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = path.dirname(resolved);

    return NextResponse.json({
      path: resolved,
      entries,
      parent: parent !== resolved ? parent : null,
    });
  } catch {
    return NextResponse.json({ error: "Cannot read directory" }, { status: 400 });
  }
}

function getDrives(): { name: string; path: string }[] {
  const drives: { name: string; path: string }[] = [];
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const drivePath = `${letter}:\\`;
    try {
      fs.accessSync(drivePath);
      drives.push({ name: `${letter}:`, path: drivePath });
    } catch {
      // drive not available
    }
  }
  return drives;
}
