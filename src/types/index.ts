export interface LocalTrack {
  id: number;
  path: string;
  size: number;
  mtime_ms: number;
  title: string | null;
  artist: string | null;
  album_artist: string | null;
  album: string | null;
  track_no: number | null;
  disc_no: number | null;
  year: number | null;
  genre: string | null;
  duration_ms: number | null;
  isrc: string | null;
  format: string | null;
  bitrate: number | null;
  has_artwork: number;
  scanned_at: string;
}

export interface SpotifyTrack {
  id: number;
  spotify_id: string;
  uri: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_art_url: string | null;
  isrc: string | null;
  duration_ms: number | null;
  added_at: string | null;
  synced_at: string;
}

export type MatchMethod = "isrc" | "search" | "manual";

export interface Match {
  id: number;
  local_track_id: number;
  spotify_track_id: number;
  method: MatchMethod;
  confidence: number;
  confirmed: number;
  matched_at: string;
}

export interface DuplicateGroup {
  id: number;
  resolution: string | null;
  resolved_at: string | null;
}

export interface DuplicateMember {
  id: number;
  group_id: number;
  local_track_id: number;
  is_keeper: number;
  quality_score: number | null;
}

export type DownloadStatus =
  | "searching"
  | "results_ready"
  | "downloading"
  | "tagging"
  | "complete"
  | "failed";

export interface Download {
  id: number;
  spotify_track_id: number;
  status: DownloadStatus;
  source_user: string | null;
  filename: string | null;
  format: string | null;
  bitrate: number | null;
  file_size: number | null;
  started_at: string | null;
  completed_at: string | null;
  destination_path: string | null;
}

export type BackupFileStatus = "pending" | "synced" | "modified" | "deleted_from_source";

export interface BackupState {
  id: number;
  source_path: string;
  dest_path: string;
  size: number | null;
  mtime_ms: number | null;
  last_synced_at: string | null;
  status: BackupFileStatus;
}

export interface SoulseekResult {
  username: string;
  file: string;
  size: number;
  bitrate: number | null;
  format: string;
  speed: number | null;
  queueLength: number | null;
}

export interface MetadataDiff {
  local_track_id: number;
  spotify_track_id: number;
  local_path: string;
  field: string;
  local_value: string | null;
  spotify_value: string | null;
}

export interface ScanProgress {
  total_files: number;
  scanned: number;
  status: "idle" | "scanning" | "complete" | "error";
  current_file?: string;
}
