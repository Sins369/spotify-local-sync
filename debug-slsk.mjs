import Database from 'better-sqlite3';
import slsk from 'slsk-client';

const db = new Database('E:/Repos/spotify-local-sync/data/sync.db');
const user = db.prepare("SELECT value FROM settings WHERE key = 'soulseek_username'").get();
const pass = db.prepare("SELECT value FROM settings WHERE key = 'soulseek_password'").get();
db.close();

console.log('Connecting as:', user?.value);

slsk.connect({ user: user?.value, pass: pass?.value }, (err, client) => {
  if (err) { console.log('Connect error:', err); process.exit(1); }
  console.log('Connected. Searching...');

  client.search({ req: 'Daft Punk Around The World', timeout: 10000 }, (err2, results) => {
    if (err2) { console.log('Search error:', err2); process.exit(1); }

    console.log('Raw results type:', typeof results);
    console.log('Is array:', Array.isArray(results));
    console.log('Length:', results?.length);

    if (results && results.length > 0) {
      console.log('First result keys:', Object.keys(results[0]));
      console.log('First result:', JSON.stringify(results[0]).substring(0, 500));

      let audioFiles = 0;
      for (const r of results) {
        for (const f of r.files || []) {
          const ext = f.file?.split('.').pop()?.toLowerCase();
          if (['mp3','flac','m4a','ogg','wav'].includes(ext)) audioFiles++;
        }
      }
      console.log('Total audio files across all results:', audioFiles);
    } else {
      console.log('No results returned');
    }

    client.destroy();
    process.exit(0);
  });
});
