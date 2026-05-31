import { compareTwoStrings } from "string-similarity";
import { normalizeTitle, normalizeArtist } from "./normalize";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackInfo {
  title: string;
  artist: string;
  duration_ms: number;
  isrc?: string;
}

export type Confidence = "confirmed" | "probable" | "no_match";

export interface MatchResult {
  spotifyId: string;
  score: number;
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const W_TITLE = 0.45;
const W_ARTIST = 0.35;
const W_DURATION = 0.2;

// ---------------------------------------------------------------------------
// Duration scoring
// ---------------------------------------------------------------------------

function scoreDuration(localMs: number, spotifyMs: number): number {
  const diffMs = Math.abs(localMs - spotifyMs);
  const diffS = diffMs / 1000;

  if (diffS <= 2) return 1.0;
  if (diffS <= 5) return 0.9;
  if (diffS <= 15) return 0.7;
  return Math.max(0, 1 - diffMs / 60000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score the similarity between a local track and a Spotify track.
 *
 * Returns a number between 0 and 1 where 1 is a perfect match.
 *
 * Weights: title similarity 0.45, artist similarity 0.35, duration 0.2.
 */
export function scoreMatch(
  local: TrackInfo,
  spotify: TrackInfo,
): number {
  const normLocalTitle = normalizeTitle(local.title);
  const normSpotifyTitle = normalizeTitle(spotify.title);
  const titleSim = compareTwoStrings(normLocalTitle, normSpotifyTitle);

  const normLocalArtist = normalizeArtist(local.artist);
  const normSpotifyArtist = normalizeArtist(spotify.artist);
  const artistSim = compareTwoStrings(normLocalArtist, normSpotifyArtist);

  const durScore = scoreDuration(local.duration_ms, spotify.duration_ms);

  let score = W_TITLE * titleSim + W_ARTIST * artistSim + W_DURATION * durScore;

  // Apply a multiplicative penalty for extreme duration mismatches.
  // If the duration is wildly off, it's very unlikely to be the same track
  // regardless of how well the title/artist match.
  if (durScore === 0) {
    score *= 0.6;
  } else if (durScore < 0.5) {
    score *= 0.8;
  }

  return score;
}

/**
 * Classify a numeric match score into a confidence bucket.
 */
export function classifyConfidence(score: number): Confidence {
  if (score > 0.9) return "confirmed";
  if (score >= 0.7) return "probable";
  return "no_match";
}

// ---------------------------------------------------------------------------
// Waterfall matcher
// ---------------------------------------------------------------------------

export interface SpotifySearchClient {
  searchByISRC(isrc: string): Promise<{ id: string; title: string; artist: string; duration_ms: number } | null>;
  searchByQuery(title: string, artist: string): Promise<Array<{ id: string; title: string; artist: string; duration_ms: number }>>;
}

/**
 * Waterfall matching strategy:
 *
 * 1. If the local track has an ISRC, search by ISRC first.  An ISRC hit is
 *    treated as a 0.99 confidence match.
 * 2. Fall back to a title+artist search, score every result, and return the
 *    best match that exceeds the 0.7 threshold.
 * 3. Return null when nothing qualifies.
 */
export async function matchLocalToSpotify(
  localTrack: TrackInfo,
  spotifyClient: SpotifySearchClient,
): Promise<MatchResult | null> {
  // --- Stage 1: ISRC lookup ---
  if (localTrack.isrc) {
    const hit = await spotifyClient.searchByISRC(localTrack.isrc);
    if (hit) {
      return {
        spotifyId: hit.id,
        score: 0.99,
        confidence: "confirmed",
      };
    }
  }

  // --- Stage 2: Title + Artist fuzzy search ---
  const candidates = await spotifyClient.searchByQuery(
    localTrack.title,
    localTrack.artist,
  );

  let bestMatch: MatchResult | null = null;

  for (const candidate of candidates) {
    const score = scoreMatch(localTrack, {
      title: candidate.title,
      artist: candidate.artist,
      duration_ms: candidate.duration_ms,
    });

    if (score >= 0.7 && (bestMatch === null || score > bestMatch.score)) {
      bestMatch = {
        spotifyId: candidate.id,
        score,
        confidence: classifyConfidence(score),
      };
    }
  }

  return bestMatch;
}
