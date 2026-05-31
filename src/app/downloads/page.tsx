"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Download,
  Check,
  X,
  Loader2,
  RefreshCw,
  Trash2,
  Music,
  RotateCcw,
  ExternalLink,
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
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "failed">("all");

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

  async function handleClear(action: string) {
    await fetch("/api/soulseek/queue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchDownloads();
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

  const filtered = downloads.filter((d) => {
    if (filter === "all") return true;
    if (filter === "active") return d.status === "downloading" || d.status === "queued";
    if (filter === "completed") return d.status === "complete";
    if (filter === "failed") return d.status === "failed";
    return true;
  });

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "Z");
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "Z");
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Downloads</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC]">Downloads</h2>
          <p className="text-[#94A3B8] text-sm mt-1">{stats.total} total downloads</p>
        </div>
        <div className="flex gap-2">
          {stats.completed > 0 && (
            <Button variant="outline" size="sm" className="text-xs border-[#334155] gap-1.5"
              onClick={() => handleClear("clear_completed")}>
              <Trash2 className="w-3 h-3" /> Clear Completed
            </Button>
          )}
          {stats.failed > 0 && (
            <Button variant="outline" size="sm" className="text-xs border-[#334155] text-red-400 gap-1.5"
              onClick={() => handleClear("clear_failed")}>
              <Trash2 className="w-3 h-3" /> Clear Failed
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Active", value: stats.active, icon: Loader2, color: "#22C55E", filterKey: "active" as const, iconClass: "animate-spin" },
          { label: "Queued", value: stats.queued, icon: Download, color: "#F59E0B", filterKey: "active" as const, iconClass: "" },
          { label: "Completed", value: stats.completed, icon: Check, color: "#22C55E", filterKey: "completed" as const, iconClass: "" },
          { label: "Failed", value: stats.failed, icon: X, color: "#EF4444", filterKey: "failed" as const, iconClass: "" },
          { label: "Total", value: stats.total, icon: Download, color: "#94A3B8", filterKey: "all" as const, iconClass: "" },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = filter === s.filterKey;
          return (
            <button key={s.label} onClick={() => setFilter(s.filterKey)}
              className={`text-left rounded-lg border p-3 transition-all ${
                isActive
                  ? "bg-[#0F172A] border-[#22C55E]/30"
                  : "bg-[#0F172A] border-[#334155] hover:border-[#475569]"
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${s.iconClass}`} style={{ color: s.color }} />
                <span className="text-[11px] text-[#94A3B8]">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-[#F8FAFC]">{s.value}</p>
            </button>
          );
        })}
      </div>

      {/* Download list */}
      {filtered.length === 0 ? (
        <Card className="bg-[#0F172A] border-[#334155]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Download className="w-10 h-10 text-[#1E293B] mb-3" />
            <p className="text-[#64748B]">
              {stats.total === 0
                ? "No downloads yet"
                : `No ${filter === "all" ? "" : filter} downloads`}
            </p>
            {stats.total === 0 && (
              <p className="text-xs text-[#475569] mt-1">Go to Sync to search and download tracks</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((dl) => (
            <Card key={dl.id} className={`bg-[#0F172A] border-[#334155] transition-all ${
              dl.status === "downloading" ? "border-[#22C55E]/30" : ""
            }`}>
              <CardContent className="flex items-center gap-4 py-3">
                {/* Album art */}
                {dl.album_art_url ? (
                  <img src={dl.album_art_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded bg-[#1E293B] flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5 text-[#475569]" />
                  </div>
                )}

                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F8FAFC] truncate">
                    {dl.title ?? dl.filename ?? "Unknown"}
                  </p>
                  <p className="text-xs text-[#94A3B8] truncate">
                    {dl.artist ?? "Unknown"}{dl.album ? ` — ${dl.album}` : ""}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {dl.source_user && (
                      <span className="text-[10px] text-[#475569]">from {dl.source_user}</span>
                    )}
                    {dl.filename && (
                      <span className="text-[10px] text-[#475569] font-mono truncate max-w-48">{dl.filename}</span>
                    )}
                  </div>
                  {dl.error && (
                    <p className="text-[11px] text-red-400 mt-1">{dl.error}</p>
                  )}
                  {dl.download_path && dl.status === "complete" && (
                    <p className="text-[10px] font-mono text-[#22C55E]/60 mt-1 truncate" title={dl.download_path}>
                      {dl.download_path.split(/[\\/]/).slice(-3).join("/")}
                    </p>
                  )}

                  {/* Progress bar for active downloads */}
                  {(dl.status === "downloading" || dl.status === "tagging") && (
                    <div className="mt-2 space-y-1">
                      <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#22C55E] rounded-full transition-all duration-500"
                          style={{ width: `${dl.percent ?? 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#64748B]">
                        <span>
                          {dl.status === "tagging" ? "Writing tags..." :
                            `${formatBytes(dl.bytes_received ?? 0)} / ${formatBytes(dl.file_size ?? 0)} — ${dl.percent ?? 0}%`}
                        </span>
                        {dl.speed && dl.status === "downloading" && <span>{formatBytes(dl.speed)}/s</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status + actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {dl.status === "queued" && (
                    <Badge className="bg-[#1E293B] text-[#94A3B8] text-[10px]">
                      Queued
                    </Badge>
                  )}
                  {dl.status === "queued" && dl.queue_position && (
                    <Badge className="bg-[#1E293B] text-[#94A3B8] text-[10px]">
                      #{dl.queue_position} in queue
                    </Badge>
                  )}
                  {dl.status === "downloading" && (
                    <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px]">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />Downloading
                    </Badge>
                  )}
                  {dl.status === "tagging" && (
                    <Badge className="bg-[#A855F7]/20 text-[#A855F7] text-[10px]">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />Tagging
                    </Badge>
                  )}
                  {dl.status === "complete" && (
                    <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px]">
                      <Check className="w-3 h-3 mr-1" />Complete
                    </Badge>
                  )}
                  {dl.status === "failed" && (
                    <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                      <X className="w-3 h-3 mr-1" />Failed
                    </Badge>
                  )}

                  <div className="flex items-center gap-1">
                    {dl.status === "complete" && dl.spotify_id && (
                      <a
                        href={`https://open.spotify.com/track/${dl.spotify_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-[#1E293B] text-[#64748B] hover:text-[#F8FAFC] transition-colors"
                        title="Open on Spotify"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {(dl.status === "queued" || dl.status === "downloading") && (
                      <button
                        onClick={() => handleCancel(dl.id)}
                        className="p-1 rounded hover:bg-[#1E293B] text-[#64748B] hover:text-red-400 transition-colors"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(dl.status === "complete" || dl.status === "failed") && (
                      <button
                        onClick={() => handleRemove(dl.id)}
                        className="p-1 rounded hover:bg-[#1E293B] text-[#64748B] hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-[#475569]">
                    {formatDate(dl.created_at)} {formatTime(dl.created_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
