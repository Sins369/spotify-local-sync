interface TrackInfo {
  album_artist: string | null;
  artist: string | null;
  album: string | null;
  track_no: number | null;
  disc_no: number | null;
  title: string | null;
  year: number | null;
  ext: string;
}

function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim();
}

function pad(n: number | null, width: number = 2): string {
  return String(n ?? 0).padStart(width, "0");
}

export function renderPath(template: string, track: TrackInfo): string {
  const albumArtist = track.album_artist || track.artist || "Unknown Artist";
  const artist = track.artist || "Unknown Artist";
  const album = track.album || "Unknown Album";
  const title = track.title || "Unknown Title";

  const result = template
    .replace(/\{AlbumArtist\}/g, sanitize(albumArtist))
    .replace(/\{Artist\}/g, sanitize(artist))
    .replace(/\{Album\}/g, sanitize(album))
    .replace(/\{Title\}/g, sanitize(title))
    .replace(/\{TrackNo\}/g, pad(track.track_no))
    .replace(/\{DiscNo\}/g, pad(track.disc_no))
    .replace(/\{Year\}/g, String(track.year ?? "Unknown Year"))
    .replace(/\{ext\}/g, track.ext);

  return result;
}
