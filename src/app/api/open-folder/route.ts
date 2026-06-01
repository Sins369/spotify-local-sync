import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    if (!filePath) {
      return NextResponse.json({ error: "filePath required" }, { status: 400 });
    }

    const folder = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
      ? path.dirname(filePath)
      : filePath;

    if (!fs.existsSync(folder)) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    exec(`explorer.exe "${folder}"`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to open folder" },
      { status: 500 },
    );
  }
}
