import Database from 'better-sqlite3';

const db = new Database('E:/Repos/spotify-local-sync/data/sync.db');

// Spotify tracks that didn't match
console.log("=== UNMATCHED SPOTIFY TRACKS (sample of 20) ===");
const unmatched = db.prepare(`
  SELECT st.title, st.artist, st.isrc
  FROM spotify_tracks st
  LEFT JOIN matches m ON st.id = m.spotify_track_id
  WHERE m.id IS NULL
  ORDER BY st.artist, st.title
  LIMIT 20
`).all();
for (const t of unmatched) {
  console.log(`  "${t.title}" by ${t.artist} [ISRC: ${t.isrc || 'none'}]`);
}

// Check if those unmatched Spotify tracks exist in local with similar names
console.log("\n=== CHECKING IF UNMATCHED SPOTIFY TRACKS EXIST LOCALLY ===");
const checkLocal = db.prepare("SELECT title, artist FROM local_tracks WHERE LOWER(title) LIKE ? AND LOWER(artist) LIKE ? LIMIT 3");
for (const t of unmatched.slice(0, 10)) {
  const titleLike = `%${t.title?.toLowerCase().split(' ')[0] || ''}%`;
  const artistLike = `%${t.artist?.toLowerCase().split(',')[0].split(' ')[0] || ''}%`;
  const locals = checkLocal.all(titleLike, artistLike);
  if (locals.length > 0) {
    console.log(`  SHOULD MATCH: Spotify "${t.title}" by ${t.artist}`);
    for (const l of locals) {
      console.log(`    -> Local: "${l.title}" by ${l.artist}`);
    }
  }
}

// Some stats
const stats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM local_tracks) as local_total,
    (SELECT COUNT(*) FROM spotify_tracks) as spotify_total,
    (SELECT COUNT(*) FROM matches) as matched,
    (SELECT COUNT(*) FROM local_tracks WHERE title IS NULL OR artist IS NULL) as local_no_metadata,
    (SELECT COUNT(*) FROM spotify_tracks WHERE title IS NULL OR artist IS NULL) as spotify_no_metadata
`).get();
console.log("\n=== STATS ===");
console.log(stats);

// Check lowest-confidence matches to verify correctness
console.log("\n=== LOWEST CONFIDENCE MATCHES (verify correctness) ===");
const lowMatches = db.prepare(`
  SELECT lt.title as local_title, lt.artist as local_artist,
         st.title as spotify_title, st.artist as spotify_artist,
         m.confidence, m.method
  FROM matches m
  JOIN local_tracks lt ON m.local_track_id = lt.id
  JOIN spotify_tracks st ON m.spotify_track_id = st.id
  ORDER BY m.confidence ASC
  LIMIT 10
`).all();
for (const m of lowMatches) {
  console.log(`  [${m.method} ${(m.confidence * 100).toFixed(0)}%] "${m.local_title}" by ${m.local_artist} => "${m.spotify_title}" by ${m.spotify_artist}`);
}

// Match method breakdown
console.log("\n=== MATCH METHOD BREAKDOWN ===");
const methods = db.prepare("SELECT method, COUNT(*) as count FROM matches GROUP BY method").all();
for (const m of methods) console.log(`  ${m.method}: ${m.count}`);

db.close();
