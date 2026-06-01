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
    const exactIndex = new Map<string, typeof spotifyTracks[0][]>();
    const normalizedIndex = new Map<string, typeof spotifyTracks[0][]>();

    for (const st of spotifyTracks) {
      if (st.isrc) {
        isrcIndex.set(st.isrc.toUpperCase(), st);
      }
      // Exact case-insensitive index
      const exactKey = `${st.title.toLowerCase()}||${st.artist.toLowerCase()}`;
      if (!exactIndex.has(exactKey)) exactIndex.set(exactKey, []);
      exactIndex.get(exactKey)!.push(st);

      // Also index by just first artist (before comma) for multi-artist tracks
      const firstArtist = st.artist.split(",")[0].trim().toLowerCase();
      const exactKeyFirstArtist = `${st.title.toLowerCase()}||${firstArtist}`;
      if (exactKeyFirstArtist !== exactKey) {
        if (!exactIndex.has(exactKeyFirstArtist)) exactIndex.set(exactKeyFirstArtist, []);
        exactIndex.get(exactKeyFirstArtist)!.push(st);
      }

      // Normalized index (strips feat, remastered, etc.)
      const key = `${normalizeTitle(st.title)}||${normalizeArtist(st.artist)}`;
      if (!normalizedIndex.has(key)) normalizedIndex.set(key, []);
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

      // Stage 2: Exact case-insensitive title+artist match
      const exactKey = `${localTrack.title.toLowerCase()}||${localTrack.artist.toLowerCase()}`;
      const exactCandidates = exactIndex.get(exactKey);
      if (exactCandidates && exactCandidates.length > 0) {
        pendingMatches.push({
          local_id: localTrack.id,
          spotify_id: exactCandidates[0].id,
          method: "search",
          confidence: 0.98,
          confirmed: 1,
        });
        matched++;
        if (processed % 100 === 0) {
          eventBus.emit("match:progress", { total, processed, matched, noMatch });
        }
        continue;
      }

      // Stage 3: Normalized title+artist lookup (strips feat, remastered, etc.)
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

        if (bestCandidate && bestScore >= 0.75) {
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

      if (bestCandidate && bestScore >= 0.75) {
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

    // Commit remaining from forward pass
    if (pendingMatches.length > 0) {
      matchBatch(pendingMatches);
      pendingMatches.length = 0;
    }

    // Reverse pass: find unmatched Spotify tracks that have a local match
    const unmatchedSpotify = db
      .prepare(
        `SELECT st.* FROM spotify_tracks st
         LEFT JOIN matches m ON st.id = m.spotify_track_id
         WHERE m.id IS NULL AND st.title IS NOT NULL AND st.artist IS NOT NULL`
      )
      .all() as Array<{
      id: number; title: string; artist: string; isrc: string | null; duration_ms: number | null;
    }>;

    const localIsrcIndex = new Map<string, { id: number; title: string; artist: string; duration_ms: number | null }>();
    const localNormIndex = new Map<string, Array<{ id: number; title: string; artist: string; duration_ms: number | null }>>();
    const allLocal = db.prepare("SELECT id, title, artist, isrc, duration_ms FROM local_tracks WHERE title IS NOT NULL AND artist IS NOT NULL").all() as Array<{
      id: number; title: string; artist: string; isrc: string | null; duration_ms: number | null;
    }>;
    const alreadyMatchedLocal = new Set(
      (db.prepare("SELECT local_track_id FROM matches").all() as Array<{ local_track_id: number }>).map(r => r.local_track_id)
    );

    // For reverse pass, allow multiple Spotify tracks to match same local track
    // (same song on different albums/compilations in Spotify)
    for (const lt of allLocal) {
      if (lt.isrc && lt.isrc.length > 3) localIsrcIndex.set(lt.isrc.toUpperCase(), lt);
      const key = `${normalizeTitle(lt.title)}||${normalizeArtist(lt.artist)}`;
      if (!localNormIndex.has(key)) localNormIndex.set(key, []);
      localNormIndex.get(key)!.push(lt);
    }

    const alreadyMatchedSpotify = new Set(
      (db.prepare("SELECT spotify_track_id FROM matches").all() as Array<{ spotify_track_id: number }>).map(r => r.spotify_track_id)
    );

    let reverseMatched = 0;
    for (const st of unmatchedSpotify) {
      if (alreadyMatchedSpotify.has(st.id)) continue;

      // ISRC reverse match — allow matching to already-matched local tracks
      if (st.isrc && st.isrc.length > 3) {
        const localHit = localIsrcIndex.get(st.isrc.toUpperCase());
        if (localHit) {
          pendingMatches.push({ local_id: localHit.id, spotify_id: st.id, method: "isrc", confidence: 0.99, confirmed: 1 });
          alreadyMatchedSpotify.add(st.id);
          reverseMatched++;
          continue;
        }
      }

      // Normalized title+artist reverse match
      const key = `${normalizeTitle(st.title)}||${normalizeArtist(st.artist)}`;
      const candidates = localNormIndex.get(key);
      if (candidates && candidates.length > 0) {
        const best = candidates[0];
        const score = scoreMatch(
          { title: best.title, artist: best.artist, duration_ms: best.duration_ms ?? 0 },
          { title: st.title, artist: st.artist, duration_ms: st.duration_ms ?? 0 }
        );
        if (score >= 0.75) {
          pendingMatches.push({ local_id: best.id, spotify_id: st.id, method: "search", confidence: score, confirmed: score >= 0.9 ? 1 : 0 });
          alreadyMatchedSpotify.add(st.id);
          reverseMatched++;
        }
      }
    }

    if (pendingMatches.length > 0) {
      matchBatch(pendingMatches);
    }

    matched += reverseMatched;
    eventBus.emit("match:complete", { total, matched, noMatch });

    return NextResponse.json({ total, matched, no_match: noMatch, reverse_matched: reverseMatched });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}
