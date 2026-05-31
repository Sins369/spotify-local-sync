export function normalizeTitle(title: string): string {
  let s = title.normalize("NFC");
  // Strip " - Remastered..." suffixes
  s = s.replace(/\s*[-–—]\s*(remaster(ed)?(\s+\d{4})?|\d{4}\s+remaster(ed)?)\s*/gi, "");
  // Strip parenthetical/bracket suffixes with keywords
  s = s.replace(/\s*\(([^)]*?(remaster(ed)?|deluxe|bonus\s+track|radio\s+edit|feat\.?|ft\.?)[^)]*?)\)/gi, "");
  s = s.replace(/\s*\[([^\]]*?(remaster(ed)?|deluxe|bonus\s+track|radio\s+edit|feat\.?|ft\.?)[^\]]*?)\]/gi, "");
  // Remove punctuation
  s = s.replace(/[^\w\s]/g, "");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function normalizeArtist(artist: string): string {
  let s = artist.normalize("NFC");
  // Strip featured artists
  s = s.replace(/\s+(feat\.?|ft\.?|featuring)\s+.*/i, "");
  // Handle "and" and "&"
  s = s.replace(/\band\b/gi, "");
  s = s.replace(/&/g, "");
  // Remove "The" prefix
  s = s.replace(/^the\s+/i, "");
  // Remove punctuation
  s = s.replace(/[^\w\s]/g, "");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function normalizeForKey(title: string, artist: string): string {
  return `${normalizeTitle(title)}||${normalizeArtist(artist)}`;
}
