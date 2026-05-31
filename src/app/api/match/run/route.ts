import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scoreMatch, classifyConfidence } from "@/lib/matcher";
import { normalizeTitle, normalizeArtist } from "@/lib/normalize";
import { eventBus } from "@/lib/event-bus";

export async function POST() {
  try {
    const db = getDb();

    const unmatchedLocal = db
      .prepare(
        `SELECT lt.* FROM local_tracks lt
         LEFT JOIN matches m ON lt.id = m.local_track_id
         WHERE m.id IS NULL AND lt.title IS NOT NULL AND lt.artist IS NOT NULL`
      )
      .all() as Array<{
      id: number;
      title: string;
      artist: string;
      album: string | null;
      duration_ms: number | null;
      isrc: string | null;
    }>;

    const spotifyTracks = db
      .prepare("SELECT * FROM spotify_tracks WHERE title IS NOT NULL AND artist IS NOT NULL")
      .all() as Array<{
      id: number;
      spotify_id: string;
      title: string;
      artist: string;
      album: string | null;
      duration_ms: number | null;
      isrc: string | null;
    }>;

    const total = unmatchedLocal.length;
    let matched = 0;
    let noMatch = 0;
    let processed = 0;

    eventBus.emit("match:start", { total });

    const insertMatch = db.prepare(`
      INSERT INTO matches (local_track_id, spotify_track_id, method, confidence, confirmed)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Build lookup indexes for fast matching
    const isrcIndex = new Map<string, typeof spotifyTracks[0]>();
    const normalizedIndex = new Map<string, typeof spotifyTracks[0][]>();

    for (const st of spotifyTracks) {
      if (st.isrc) {
        isrcIndex.set(st.isrc.toUpperCase(), st);
      }
      const key = `${normalizeTitle(st.title)}||${normalizeArtist(st.artist)}`;
      if (!normalizedIndex.has(key)) {
        normalizedIndex.set(key, []);
      }
      normalizedIndex.get(key)!.push(st);
    }

    // Batch inserts in a transaction for speed
    const matchBatch = db.transaction((matches: Array<{
      local_id: number; spotify_id: number; method: string; confidence: number; confirmed: number;
    }>) => {
      for (const m of matches) {
        insertMatch.run(m.local_id, m.spotify_id, m.method, m.confidence, m.confirmed);
      }
    });

    const pendingMatches: Array<{
      local_id: number; spotify_id: number; method: string; confidence: number; confirmed: number;
    }> = [];

    for (const localTrack of unmatchedLocal) {
      processed++;

      // Stage 1: ISRC exact match (instant, no API call)
      if (localTrack.isrc) {
        const isrcHit = isrcIndex.get(localTrack.isrc.toUpperCase());
        if (isrcHit) {
          pendingMatches.push({
            local_id: localTrack.id,
            spotify_id: isrcHit.id,
            method: "isrc",
            confidence: 0.99,
            confirmed: 1,
          });
          matched++;
          if (processed % 100 === 0) {
            eventBus.emit("match:progress", { total, processed, matched, noMatch });
          }
          continue;
        }
      }

      // Stage 2: Normalized title+artist lookup (instant, no API call)
      const localKey = `${normalizeTitle(localTrack.title)}||${normalizeArtist(localTrack.artist)}`;
      const candidates = normalizedIndex.get(localKey);

      if (candidates && candidates.length > 0) {
        let bestScore = 0;
        let bestCandidate: typeof spotifyTracks[0] | null = null;

        for (const candidate of candidates) {
          const score = scoreMatch(
            { title: localTrack.title, artist: localTrack.artist, duration_ms: localTrack.duration_ms ?? 0 },
            { title: candidate.title, artist: candidate.artist, duration_ms: candidate.duration_ms ?? 0 }
          );
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = candidate;
          }
        }

        if (bestCandidate && bestScore >= 0.7) {
          const confidence = classifyConfidence(bestScore);
          pendingMatches.push({
            local_id: localTrack.id,
            spotify_id: bestCandidate.id,
            method: "search",
            confidence: bestScore,
            confirmed: confidence === "confirmed" ? 1 : 0,
          });
          matched++;
          if (processed % 100 === 0) {
            eventBus.emit("match:progress", { total, processed, matched, noMatch });
          }
          continue;
        }
      }

      // Stage 3: Fuzzy match against ALL spotify tracks (still local, no API)
      let bestScore = 0;
      let bestCandidate: typeof spotifyTracks[0] | null = null;

      for (const st of spotifyTracks) {
        const score = scoreMatch(
          { title: localTrack.title, artist: localTrack.artist, duration_ms: localTrack.duration_ms ?? 0 },
          { title: st.title, artist: st.artist, duration_ms: st.duration_ms ?? 0 }
        );
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = st;
        }
      }

      if (bestCandidate && bestScore >= 0.7) {
        const confidence = classifyConfidence(bestScore);
        pendingMatches.push({
          local_id: localTrack.id,
          spotify_id: bestCandidate.id,
          method: "search",
          confidence: bestScore,
          confirmed: confidence === "confirmed" ? 1 : 0,
        });
        matched++;
      } else {
        noMatch++;
      }

      if (processed % 100 === 0) {
        eventBus.emit("match:progress", { total, processed, matched, noMatch });
      }

      // Commit in batches of 500
      if (pendingMatches.length >= 500) {
        matchBatch(pendingMatches);
        pendingMatches.length = 0;
      }
    }

    // Commit remaining
    if (pendingMatches.length > 0) {
      matchBatch(pendingMatches);
    }

    eventBus.emit("match:complete", { total, matched, noMatch });

    return NextResponse.json({ total, matched, no_match: noMatch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}
