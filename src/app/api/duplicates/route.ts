import { NextResponse } from "next/server";
import fs from "fs";
import { getDb } from "@/lib/db";
import {
  findDuplicateGroups,
  scoreTrackQuality,
} from "@/lib/duplicate-detector";
import type { LocalTrack } from "@/types";

export async function GET() {
  try {
    const db = getDb();

    // Get unresolved duplicate groups with their members
    const groups = db
      .prepare(
        `SELECT dg.id, dg.resolution, dg.resolved_at, dg.created_at
         FROM duplicate_groups dg
         WHERE dg.resolution IS NULL
         ORDER BY dg.created_at DESC`
      )
      .all() as Array<{
      id: number;
      resolution: string | null;
      resolved_at: string | null;
      created_at: string;
    }>;

    const getMembers = db.prepare(
      `SELECT dm.*, lt.path, lt.title, lt.artist, lt.album, lt.codec,
              lt.bitrate, lt.sample_rate, lt.duration_ms, lt.size_bytes
       FROM duplicate_members dm
       JOIN local_tracks lt ON dm.local_track_id = lt.id
       WHERE dm.group_id = ?
       ORDER BY dm.quality_score DESC`
    );

    const result = groups.map((group) => ({
      ...group,
      members: getMembers.all(group.id),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to get duplicates",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const db = getDb();

    // Remove stale records (files moved to trash or deleted)
    const allRecords = db.prepare("SELECT id, path FROM local_tracks").all() as Array<{ id: number; path: string }>;
    const staleIds = allRecords.filter((r) => !fs.existsSync(r.path)).map((r) => r.id);
    if (staleIds.length > 0) {
      const deleteTrack = db.prepare("DELETE FROM local_tracks WHERE id = ?");
      const deleteMatch = db.prepare("DELETE FROM matches WHERE local_track_id = ?");
      const deleteDupMember = db.prepare("DELETE FROM duplicate_members WHERE local_track_id = ?");
      db.transaction(() => {
        for (const id of staleIds) {
          deleteMatch.run(id);
          deleteDupMember.run(id);
          deleteTrack.run(id);
        }
      })();
    }

    // Get all local tracks (now clean)
    const allTracks = db
      .prepare("SELECT * FROM local_tracks")
      .all() as LocalTrack[];

    const duplicateGroups = findDuplicateGroups(allTracks);

    // Clear existing unresolved groups
    const unresolvedIds = db
      .prepare("SELECT id FROM duplicate_groups WHERE resolution IS NULL")
      .all() as Array<{ id: number }>;

    const deleteMembers = db.prepare(
      "DELETE FROM duplicate_members WHERE group_id = ?"
    );
    const deleteGroup = db.prepare(
      "DELETE FROM duplicate_groups WHERE id = ?"
    );

    const insertGroup = db.prepare(
      "INSERT INTO duplicate_groups (created_at) VALUES (datetime('now'))"
    );
    const insertMember = db.prepare(
      `INSERT INTO duplicate_members (group_id, local_track_id, quality_score)
       VALUES (?, ?, ?)`
    );

    const insertAll = db.transaction(() => {
      // Clean up old unresolved groups
      for (const { id } of unresolvedIds) {
        deleteMembers.run(id);
        deleteGroup.run(id);
      }

      // Insert new groups
      for (const group of duplicateGroups) {
        const groupResult = insertGroup.run();
        const groupId = groupResult.lastInsertRowid;

        for (const member of group.members) {
          const qualityScore = scoreTrackQuality(member);
          insertMember.run(groupId, member.id, qualityScore);
        }
      }
    });

    insertAll();

    return NextResponse.json({
      groups_found: duplicateGroups.length,
      total_duplicate_tracks: duplicateGroups.reduce(
        (sum, g) => sum + g.members.length,
        0
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Duplicate scan failed",
      },
      { status: 500 }
    );
  }
}
