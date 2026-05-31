import { NextRequest, NextResponse } from "next/server";
import { writeTags } from "@/lib/metadata-writer";

interface MetadataChange {
  local_path: string;
  field: string;
  spotify_value: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { changes } = body as { changes: MetadataChange[] };

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: "changes array is required" },
        { status: 400 }
      );
    }

    // Group changes by file path
    const byFile = new Map<string, Record<string, string>>();
    for (const change of changes) {
      if (!change.local_path || !change.field || change.spotify_value == null) {
        continue;
      }
      const existing = byFile.get(change.local_path) || {};
      if (change.field === "artwork") {
        existing.artworkUrl = change.spotify_value;
      } else {
        existing[change.field] = change.spotify_value;
      }
      byFile.set(change.local_path, existing);
    }

    let applied = 0;
    const errors: Array<{ path: string; error: string }> = [];

    for (const [filePath, tags] of byFile) {
      try {
        await writeTags(filePath, tags);
        applied++;
      } catch (error) {
        errors.push({
          path: filePath,
          error: error instanceof Error ? error.message : "Failed to write tags",
        });
      }
    }

    return NextResponse.json({ applied, errors });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to apply metadata",
      },
      { status: 500 }
    );
  }
}
