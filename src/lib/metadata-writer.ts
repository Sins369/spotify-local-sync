import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import type { MetadataDiff } from "@/types";

const execFileAsync = promisify(execFile);

interface LocalTrackInput {
  id: number;
  path: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  has_artwork?: boolean | number;
}

interface SpotifyTrackInput {
  id: number;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  album_art_url?: string | null;
}

interface TagsToWrite {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
}

/**
 * Compares local and Spotify track metadata, returning an array of differences.
 */
export function buildMetadataDiffs(
  local: LocalTrackInput,
  spotify: SpotifyTrackInput
): MetadataDiff[] {
  const diffs: MetadataDiff[] = [];
  const fields = ["title", "artist", "album"] as const;

  for (const field of fields) {
    const localVal = local[field] ?? null;
    const spotifyVal = spotify[field] ?? null;
    if (localVal !== spotifyVal) {
      diffs.push({
        local_track_id: local.id,
        spotify_track_id: spotify.id,
        local_path: local.path,
        field,
        local_value: localVal,
        spotify_value: spotifyVal,
      });
    }
  }

  // Check artwork: if Spotify has art and local doesn't
  const hasLocalArtwork =
    local.has_artwork === true || local.has_artwork === 1;
  if (spotify.album_art_url && !hasLocalArtwork) {
    diffs.push({
      local_track_id: local.id,
      spotify_track_id: spotify.id,
      local_path: local.path,
      field: "artwork",
      local_value: null,
      spotify_value: spotify.album_art_url,
    });
  }

  return diffs;
}

/**
 * Downloads an image from a URL and returns the buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Writes ID3 tags to an MP3 file using node-id3.
 */
export async function writeTagsToMp3(
  filePath: string,
  tags: TagsToWrite
): Promise<void> {
  const NodeID3 = await import("node-id3");

  const id3Tags: Record<string, unknown> = {};
  if (tags.title) id3Tags.title = tags.title;
  if (tags.artist) id3Tags.artist = tags.artist;
  if (tags.album) id3Tags.album = tags.album;

  if (tags.artworkUrl) {
    const imageBuffer = await downloadImage(tags.artworkUrl);
    id3Tags.image = {
      mime: "image/jpeg",
      type: { id: 3, name: "front cover" },
      description: "Album Art",
      imageBuffer,
    };
  }

  const result = NodeID3.update(id3Tags, filePath);
  if (result !== true) {
    throw new Error(`Failed to write MP3 tags to ${filePath}`);
  }
}

/**
 * Writes tags to a FLAC file using the metaflac CLI.
 */
export async function writeTagsToFlac(
  filePath: string,
  tags: TagsToWrite
): Promise<void> {
  const args: string[] = [];

  if (tags.title) {
    args.push("--remove-tag=TITLE", `--set-tag=TITLE=${tags.title}`);
  }
  if (tags.artist) {
    args.push("--remove-tag=ARTIST", `--set-tag=ARTIST=${tags.artist}`);
  }
  if (tags.album) {
    args.push("--remove-tag=ALBUM", `--set-tag=ALBUM=${tags.album}`);
  }

  if (args.length > 0) {
    args.push(filePath);
    await execFileAsync("metaflac", args);
  }

  if (tags.artworkUrl) {
    const imageBuffer = await downloadImage(tags.artworkUrl);
    const tempPath = path.join(
      path.dirname(filePath),
      `.artwork-${Date.now()}.jpg`
    );
    const fs = await import("fs/promises");
    try {
      await fs.writeFile(tempPath, imageBuffer);
      await execFileAsync("metaflac", [
        "--import-picture-from",
        tempPath,
        filePath,
      ]);
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}

/**
 * Dispatches tag writing to the appropriate handler based on file extension.
 */
export async function writeTags(
  filePath: string,
  tags: TagsToWrite
): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".mp3":
      return writeTagsToMp3(filePath, tags);
    case ".flac":
      return writeTagsToFlac(filePath, tags);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}
