import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { group_id, keeper_track_id, action } = body;

    if (!group_id) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }

    // "keep_all" just marks resolved without moving anything
    if (action === "keep_all") {
      const db = getDb();
      db.prepare(
        "UPDATE duplicate_groups SET resolution = 'keep_all', resolved_at = datetime('now') WHERE id = ?"
      ).run(group_id);
      return NextResponse.json({ success: true, moved: 0 });
    }

    if (!keeper_track_id) {
      return NextResponse.json(
        { error: "keeper_track_id is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify the group exists
    const group = db
      .prepare("SELECT * FROM duplicate_groups WHERE id = ?")
      .get(group_id) as { id: number; resolution: string | null } | undefined;

    if (!group) {
      return NextResponse.json(
        { error: "Duplicate group not found" },
        { status: 404 }
      );
    }

    // Get all members of this group
    const members = db
      .prepare(
        `SELECT dm.*, lt.path FROM duplicate_members dm
         JOIN local_tracks lt ON dm.local_track_id = lt.id
         WHERE dm.group_id = ?`
      )
      .all(group_id) as Array<{
      id: number;
      local_track_id: number;
      path: string;
    }>;

    const trashDir =
      getSetting("trash_path") ||
      getSetting("trash_folder") ||
      path.join(process.cwd(), "data", "trash");

    // Ensure trash directory exists
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    let moved = 0;

    for (const member of members) {
      if (member.local_track_id === keeper_track_id) {
        // Mark as keeper
        db.prepare(
          "UPDATE duplicate_members SET is_keeper = 1 WHERE id = ?"
        ).run(member.id);
        continue;
      }

      // Move non-keeper files to trash
      const destPath = path.join(trashDir, path.basename(member.path));
      try {
        if (fs.existsSync(member.path)) {
          fs.renameSync(member.path, destPath);
          moved++;
        }
      } catch {
        try {
          fs.copyFileSync(member.path, destPath);
          fs.unlinkSync(member.path);
          moved++;
        } catch {
          // Skip files that can't be moved
        }
      }
    }

    // Mark group as resolved
    db.prepare(
      "UPDATE duplicate_groups SET resolution = ?, resolved_at = datetime('now') WHERE id = ?"
    ).run(action || "trash", group_id);

    return NextResponse.json({
      success: true,
      keeper_track_id,
      moved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to resolve duplicates",
      },
      { status: 500 }
    );
  }
}
