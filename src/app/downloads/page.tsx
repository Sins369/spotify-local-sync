"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check,
  Loader2,
  Music,
  RotateCcw,
  FolderOpen,
} from "lucide-react";

interface DownloadRecord {
  id: number;
  spotify_track_id: number;
  status: string;
  source_user: string | null;
  filename: string | null;
  download_path: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  spotify_id: string | null;
  album_art_url: string | null;
  file_size: number | null;
  bytes_received: number | null;
  percent: number | null;
  speed: number | null;
  queue_position: number | null;
  format: string | null;
  bitrate: number | null;
}

interface QueueStats {
  active: number;
  queued: number;
  completed: number;
  failed: number;
  total: number;
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [stats, setStats] = useState<QueueStats>({ active: 0, queued: 0, completed: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [downloadPath, setDownloadPath] = useState<string>("");

  const fetchDownloads = useCallback(async () => {
    try {
      const res = await fetch("/api/soulseek/queue");
      if (res.ok) {
        const data = await res.json();
        setDownloads(data.downloads ?? []);
        setStats(data.stats ?? { active: 0, queued: 0, completed: 0, failed: 0, total: 0 });
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 2000);
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => setDownloadPath(data.download_path || ""))
      .catch(() => {});
  }, []);

  async function handleRetryFailed() {
    await fetch("/api/soulseek/retry-failed", { method: "POST" });
    fetchDownloads();
  }

  async function handleClearQueue() {
    await fetch("/api/soulseek/clear-queue", { method: "POST" });
    fetchDownloads();
  }

  async function handleOpenFolder() {
    await fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderPath: downloadPath }),
    });
  }

  async function handleRemove(id: number) {
    await fetch("/api/soulseek/queue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", id }),
    });
    fetchDownloads();
  }

  async function handleCancel(id: number) {
    await fetch("/api/soulseek/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ download_id: id }),
    });
    fetchDownloads();
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Track IDs that completed successfully
  const completedTrackIds = new Set(
    downloads.filter((d) => d.status === "complete").map((d) => d.spotify_track_id)
  );

  // Group downloads by status, hiding failed entries for tracks that eventually completed,
  // and deduplicating failed entries per track (keep only the most recent attempt)
  const searching = downloads.filter((d) => d.status === "pending_search");
  const active = downloads.filter((d) => d.status === "downloading" || d.status === "tagging");
  const queued = downloads.filter((d) => d.status === "queued");
  const completed = downloads.filter((d) => d.status === "complete");

  const failedAll = downloads.filter((d) => d.status === "failed" && !completedTrackIds.has(d.spotify_track_id));
  const seenFailedTracks = new Set<number>();
  const failed = failedAll.filter((d) => {
    if (seenFailedTracks.has(d.spotify_track_id)) return false;
    seenFailedTracks.add(d.spotify_track_id);
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4 ">
        <h2 className="text-[22px] font-[800] text-[#e0e0e8]">Downloads</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[#34d399] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-[800] text-[#e0e0e8]">Downloads</h2>
          <p className="text-[#8888a0] text-[12px] mt-0.5">{stats.total} total</p>
        </div>
        <div className="flex gap-2">
          {stats.failed > 0 && (
            <button
              onClick={handleRetryFailed}
              className="px-3 py-1.5 bg-[#24243a] text-[#e0e0e8] text-[12px] rounded-[4px] hover:bg-[#34d399] hover:text-[#12121c] transition-colors"
            >
              Retry Failed
            </button>
          )}
          {stats.queued > 0 && (
            <button
              onClick={handleClearQueue}
              className="px-3 py-1.5 bg-[#24243a] text-[#e0e0e8] text-[12px] rounded-[4px] hover:bg-[#34d399] hover:text-[#12121c] transition-colors"
            >
              Clear Queue
            </button>
          )}
          <button
            onClick={handleOpenFolder}
            className="px-3 py-1.5 bg-[#24243a] text-[#e0e0e8] text-[12px] rounded-[4px] hover:bg-[#34d399] hover:text-[#12121c] transition-colors flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open Folder
          </button>
        </div>
      </div>

      {/* Two-column layout: queue on left, completed on right */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: Active / Queued / Failed */}
        <div className="flex-[3] min-w-0 space-y-6">
          <Section label="Active" count={active.length}>
            {active.map((dl) => (
              <DownloadCard
                key={dl.id}
                dl={dl}
                onCancel={handleCancel}
                onRemove={handleRemove}
                onRetryToggle={() => {}}
                retryingId={retryingId}
                formatBytes={formatBytes}
              />
            ))}
          </Section>

          <Section label="Queued" count={queued.length}>
            {queued.map((dl) => (
              <DownloadCard
                key={dl.id}
                dl={dl}
                onCancel={handleCancel}
                onRemove={handleRemove}
                onRetryToggle={() => {}}
                retryingId={retryingId}
                formatBytes={formatBytes}
              />
            ))}
          </Section>

          {searching.length > 0 && (
            <Section label="Searching" count={searching.length}>
              {searching.map((dl) => (
                <div key={dl.id} className="bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] rounded-[4px] p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[3px] bg-[#24243a] flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-[#f59e0b] animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-[#e0e0e8] truncate leading-tight">{dl.title ?? "Unknown"}</p>
                    <p className="text-[12px] text-[#8888a0] truncate mt-0.5">{dl.artist ?? "Unknown"}</p>
                    <p className="text-[10px] text-[#5a5a6e] mt-1">Searching Soulseek...</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#f59e0b]/20 text-[#f59e0b]">Searching</span>
                </div>
              ))}
            </Section>
          )}

          <Section label="Failed" count={failed.length}>
            {failed.map((dl) => (
              <div key={dl.id}>
                <DownloadCard
                  dl={dl}
                  onCancel={handleCancel}
                  onRemove={handleRemove}
                  onRetryToggle={() => setRetryingId(retryingId === dl.id ? null : dl.id)}
                  retryingId={retryingId}
                  formatBytes={formatBytes}
                />
                {retryingId === dl.id && (
                  <div className="ml-[52px] mt-1 mb-2 p-3 bg-[#141420] border border-[rgba(255,255,255,0.06)] rounded-[4px]">
                    <RetryPanel
                      trackId={dl.spotify_track_id}
                      title={dl.title ?? ""}
                      artist={dl.artist ?? ""}
                      onQueued={() => { setRetryingId(null); fetchDownloads(); }}
                    />
                  </div>
                )}
              </div>
            ))}
          </Section>
        </div>

        {/* Right column: Completed */}
        <div className="flex-[2] min-w-0">
          <Section label="Completed" count={completed.length}>
            {completed.map((dl) => (
              <DownloadCard
                key={dl.id}
                dl={dl}
                onCancel={handleCancel}
                onRemove={handleRemove}
                onRetryToggle={() => {}}
                retryingId={retryingId}
                formatBytes={formatBytes}
              />
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="uppercase text-[10px] font-[700] tracking-[1.5px] text-[#5a5a6e]">
          {label}
        </span>
        <span className="text-[10px] font-[700] text-[#5a5a6e] bg-[#24243a] px-1.5 py-0.5 rounded-[3px]">
          {count}
        </span>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function DownloadCard({
  dl,
  onCancel,
  onRemove,
  onRetryToggle,
  retryingId,
  formatBytes,
}: {
  dl: DownloadRecord;
  onCancel: (id: number) => void;
  onRemove: (id: number) => void;
  onRetryToggle: () => void;
  retryingId: number | null;
  formatBytes: (bytes: number) => string;
}) {
  const isFlac = dl.format?.toLowerCase() === "flac";
  const isMp3 = dl.format?.toLowerCase() === "mp3";

  return (
    <div className="bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] rounded-[4px] p-3 flex items-start gap-3">
      {/* Album art */}
      {dl.album_art_url ? (
        <img src={dl.album_art_url} alt="" className="w-10 h-10 rounded-[3px] object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-[3px] bg-[#24243a] flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-[#5a5a6e]" />
        </div>
      )}

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-[#e0e0e8] truncate leading-tight">
          {dl.title ?? dl.filename ?? "Unknown"}
        </p>
        <p className="text-[12px] text-[#8888a0] truncate mt-0.5">
          {dl.artist ?? "Unknown"}{dl.album ? ` — ${dl.album}` : ""}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {dl.source_user && (
            <span className="text-[10px] text-[#5a5a6e] font-mono">{dl.source_user}</span>
          )}
          {dl.filename && (
            <span className="text-[10px] text-[#5a5a6e] font-mono truncate max-w-[200px]">
              {dl.filename.split(/[\\/]/).pop()}
            </span>
          )}
        </div>

        {/* Error message for failed */}
        {dl.error && (
          <p className="text-[11px] text-[#e05566] mt-1">{dl.error}</p>
        )}

        {/* File path for completed */}
        {dl.download_path && dl.status === "complete" && (
          <p className="text-[10px] font-mono text-[#5a5a6e] mt-1 truncate" title={dl.download_path}>
            {dl.download_path}
          </p>
        )}

        {/* Progress bar for active downloads */}
        {(dl.status === "downloading" || dl.status === "tagging") && (
          <div className="mt-2">
            <div className="w-full h-[4px] bg-[#24243a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#34d399] rounded-full transition-all duration-500"
                style={{ width: `${dl.percent ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#5a5a6e] mt-1">
              <span>
                {dl.status === "tagging"
                  ? "Writing tags..."
                  : `${formatBytes(dl.bytes_received ?? 0)} / ${formatBytes(dl.file_size ?? 0)} — ${dl.percent ?? 0}%`}
              </span>
              {dl.speed != null && dl.status === "downloading" && (
                <span>{formatBytes(dl.speed)}/s</span>
              )}
            </div>
          </div>
        )}

        {/* Queue position for queued */}
        {dl.status === "queued" && dl.queue_position != null && (
          <p className="text-[10px] text-[#8888a0] mt-1">#{dl.queue_position} in queue</p>
        )}
      </div>

      {/* Right side: badges + actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Format badge */}
          {isFlac && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#34d399]/20 text-[#34d399] font-medium">
              FLAC
            </span>
          )}
          {isMp3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#24243a] text-[#8888a0] font-medium">
              MP3
            </span>
          )}
          {dl.format && !isFlac && !isMp3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#24243a] text-[#8888a0] font-medium">
              {dl.format.toUpperCase()}
            </span>
          )}
          {dl.bitrate != null && (
            <span className="text-[10px] text-[#5a5a6e]">
              {dl.bitrate > 1000 ? `${Math.round(dl.bitrate / 1000)}k` : `${dl.bitrate}k`}
            </span>
          )}

          {/* Status badge */}
          {dl.status === "downloading" && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#34d399]/20 text-[#34d399]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Downloading
            </span>
          )}
          {dl.status === "tagging" && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#34d399]/20 text-[#34d399]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Tagging
            </span>
          )}
          {dl.status === "queued" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#24243a] text-[#8888a0]">
              Queued
            </span>
          )}
          {dl.status === "failed" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#e05566]/20 text-[#e05566]">
              Failed
            </span>
          )}
          {dl.status === "complete" && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#34d399]/20 text-[#34d399]">
              <Check className="w-3 h-3" />
              Complete
            </span>
          )}
        </div>

        {/* Action links */}
        <div className="flex items-center gap-2 mt-0.5">
          {(dl.status === "queued" || dl.status === "downloading") && (
            <button
              onClick={() => onCancel(dl.id)}
              className="text-[10px] text-[#5a5a6e] hover:text-[#e05566] transition-colors"
            >
              Cancel
            </button>
          )}
          {dl.status === "failed" && (
            <button
              onClick={onRetryToggle}
              className={`text-[10px] transition-colors flex items-center gap-0.5 ${
                retryingId === dl.id ? "text-[#34d399]" : "text-[#5a5a6e] hover:text-[#34d399]"
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          )}
          {(dl.status === "complete" || dl.status === "failed") && (
            <button
              onClick={() => onRemove(dl.id)}
              className="text-[10px] text-[#5a5a6e] hover:text-[#e05566] transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RetryPanel({ trackId, title, artist, onQueued }: {
  trackId: number; title: string; artist: string; onQueued: () => void;
}) {
  const [results, setResults] = useState<Array<{ username: string; file: string; size: number; bitrate: number | null; format: string }>>([]);
  const [searching, setSearching] = useState(true);
  const [failedUsers, setFailedUsers] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/soulseek/failed-users?track_id=${trackId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((users: string[]) => setFailedUsers(new Set(users)))
      .catch(() => {});

    fetch("/api/soulseek/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${artist} ${title}` }),
    })
      .then((r) => r.ok ? r.json() : { results: [] })
      .then((data) => {
        const all = Array.isArray(data) ? data : data.results ?? [];
        setResults(all.slice(0, 20));
      })
      .catch(() => setError("Search failed"))
      .finally(() => setSearching(false));
  }, [trackId, title, artist]);

  async function handleDownload(result: typeof results[0]) {
    setDownloading(result.file);
    setError(null);
    try {
      const res = await fetch("/api/soulseek/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_track_id: trackId,
          username: result.username,
          file: result.file,
          file_size: result.size,
          format: result.format,
          bitrate: result.bitrate,
        }),
      });
      if (res.ok) {
        onQueued();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to queue");
      }
    } catch {
      setError("Failed to queue download");
    } finally {
      setDownloading(null);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-[#8888a0]">
        {searching ? "Searching Soulseek..." : `${results.length} results — pick a new source`}
      </p>
      {error && <p className="text-[11px] text-[#e05566]">{error}</p>}
      {searching ? (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="w-4 h-4 text-[#34d399] animate-spin" />
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map((r, i) => {
            const isFailed = failedUsers.has(r.username);
            const filename = r.file.split(/[\\/]/).pop() ?? r.file;
            const isFlac = r.format?.toLowerCase() === "flac";
            return (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-[4px] border transition-colors ${
                  isFailed
                    ? "border-[#e05566]/20 bg-[#e05566]/5 opacity-50"
                    : "border-[rgba(255,255,255,0.06)] bg-[#1c1c28] hover:bg-[#24243a]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[#e0e0e8] truncate font-mono">{filename}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Format badge */}
                    {isFlac ? (
                      <span className="text-[9px] px-1 py-0 rounded-[2px] bg-[#34d399]/20 text-[#34d399] font-medium">
                        FLAC
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0 rounded-[2px] bg-[#24243a] text-[#8888a0] font-medium">
                        {r.format.toUpperCase()}
                      </span>
                    )}
                    {r.bitrate != null && (
                      <span className="text-[10px] text-[#5a5a6e]">
                        {r.bitrate > 1000 ? `${Math.round(r.bitrate / 1000)} kbps` : `${r.bitrate} kbps`}
                      </span>
                    )}
                    <span className="text-[10px] text-[#5a5a6e]">{formatSize(r.size)}</span>
                    <span className={`text-[10px] ${isFailed ? "text-[#e05566]" : "text-[#5a5a6e]"}`}>
                      {r.username}
                    </span>
                    {isFailed && (
                      <span className="text-[9px] px-1 py-0 rounded-[2px] bg-[#e05566]/20 text-[#e05566]">
                        FAILED
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(r)}
                  disabled={downloading !== null}
                  className="text-[10px] px-2.5 py-1 rounded-[4px] bg-[#24243a] text-[#e0e0e8] hover:bg-[#34d399] hover:text-[#12121c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {downloading === r.file ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Download"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
