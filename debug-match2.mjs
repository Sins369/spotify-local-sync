import Database from 'better-sqlite3';

const db = new Database('E:/Repos/spotify-local-sync/data/sync.db');

// Why didn't "Pleasure" by 1991 match?
console.log("=== Pleasure by 1991 ===");
const local = db.prepare("SELECT id, title, artist, isrc FROM local_tracks WHERE LOWER(title) = 'pleasure' AND LOWER(artist) LIKE '%1991%'").all();
const spotify = db.prepare("SELECT id, title, artist, isrc FROM spotify_tracks WHERE LOWER(title) = 'pleasure' AND LOWER(artist) LIKE '%1991%'").all();
console.log("Local:", local);
console.log("Spotify:", spotify);

// Count how many Spotify tracks have a local track with same title+artist (case insensitive)
const shouldMatch = db.prepare(`
  SELECT COUNT(*) as count FROM spotify_tracks st
  WHERE EXISTS (
    SELECT 1 FROM local_tracks lt
    WHERE LOWER(lt.title) = LOWER(st.title)
    AND LOWER(lt.artist) = LOWER(st.artist)
  )
  AND NOT EXISTS (
    SELECT 1 FROM matches m WHERE m.spotify_track_id = st.id
  )
`).get();
console.log("\n=== Spotify tracks with EXACT title+artist match locally but NOT matched ===");
console.log(shouldMatch);

// Show some examples
const examples = db.prepare(`
  SELECT st.title, st.artist, lt.title as local_title, lt.artist as local_artist
  FROM spotify_tracks st
  JOIN local_tracks lt ON LOWER(lt.title) = LOWER(st.title) AND LOWER(lt.artist) = LOWER(st.artist)
  LEFT JOIN matches m ON st.id = m.spotify_track_id
  WHERE m.id IS NULL
  LIMIT 20
`).all();
console.log("\nExamples:");
for (const e of examples) {
  console.log(`  Spotify: "${e.title}" by ${e.artist}`);
  console.log(`  Local:   "${e.local_title}" by ${e.local_artist}`);
  console.log();
}

// Also check: how many local tracks have the spotify track as a substring match?
const partialMatch = db.prepare(`
  SELECT COUNT(*) as count FROM spotify_tracks st
  WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.spotify_track_id = st.id)
  AND EXISTS (
    SELECT 1 FROM local_tracks lt
    WHERE LOWER(lt.title) LIKE '%' || LOWER(st.title) || '%'
    AND LOWER(lt.artist) LIKE '%' || LOWER(SUBSTR(st.artist, 1, INSTR(st.artist || ',', ',') - 1)) || '%'
  )
`).get();
console.log("\n=== Spotify tracks with PARTIAL title + first-artist match locally but NOT matched ===");
console.log(partialMatch);

db.close();
