"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ScanSearch,
  RefreshCw,
  GitCompareArrows,
  Archive,
  Loader2,
} from "lucide-react";

interface ScanStats {
  total_local_tracks: number;
  matched_tracks: number;
  spotify_tracks: number;
  unmatched_tracks: number;
  duplicate_groups: number;
  last_scan: string | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  detail: string;
  color: string;
  created_at: string;
}

const COLOR_MAP: Record<string, string> = {
  primary: "#34d399",
  green: "#34d399",
  yellow: "#f59e0b",
  red: "#e05566",
  blue: "#60a5fa",
  gray: "#8888a0",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function logActivity(action: string, detail: string, color: string) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, detail, color }),
    });
  } catch {}
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionProgress, setActionProgress] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/stats");
      if (res.ok) setStats(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.entries ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchActivity();
  }, [fetchStats, fetchActivity]);

  async function handleAction(action: string) {
    setActionLoading(action);
    setActionProgress((prev) => ({ ...prev, [action]: 0 }));
    try {
      let detail = "";
      if (action === "scan") {
        const eventSource = new EventSource("/api/scan/progress");
        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const total = data.total ?? 0;
            const current = data.scanned ?? 0;
            setActionProgress((prev) => ({ ...prev, scan: total > 0 ? Math.round((current / total) * 100) : 0 }));
          } catch {}
        };
        const res = await fetch("/api/scan", { method: "POST" });
        eventSource.close();
        const data = await res.json();
        detail = `Scanned ${data.total_tracks ?? 0} files`;
        await logActivity("Library Scan", detail, "green");
      } else if (action === "sync") {
        setActionProgress((prev) => ({ ...prev, sync: 50 }));
        const res = await fetch("/api/spotify/sync", { method: "POST" });
        const data = await res.json();
        setActionProgress((prev) => ({ ...prev, sync: 100 }));
        detail = `Synced ${data.synced ?? data.total ?? 0} tracks`;
        await logActivity("Spotify Sync", detail, "green");
      } else if (action === "match") {
        const matchEs = new EventSource("/api/match/progress");
        matchEs.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const total = data.total ?? 0;
            const current = data.processed ?? 0;
            setActionProgress((prev) => ({ ...prev, match: total > 0 ? Math.round((current / total) * 100) : 0 }));
          } catch {}
        };
        const res = await fetch("/api/match/run", { method: "POST" });
        matchEs.close();
        const data = await res.json();
        detail = `Matched ${data.matched ?? 0} of ${data.total ?? 0} tracks`;
        await logActivity("Track Matching", detail, "primary");
      } else if (action === "backup") {
        setActionProgress((prev) => ({ ...prev, backup: 50 }));
        const res = await fetch("/api/backup/sync", { method: "POST" });
        const data = await res.json();
        setActionProgress((prev) => ({ ...prev, backup: 100 }));
        detail = data.message ?? "Backup complete";
        await logActivity("Backup", detail, "blue");
      }
      await Promise.all([fetchStats(), fetchActivity()]);
    } catch {
      const label = action === "scan" ? "Library Scan" : action === "sync" ? "Spotify Sync" : action === "match" ? "Track Matching" : "Backup";
      await logActivity(label, "Failed", "red");
      await fetchActivity();
    } finally {
      setActionLoading(null);
      setActionProgress((prev) => {
        const next = { ...prev };
        delete next[action];
        return next;
      });
    }
  }

  const localCount = stats?.total_local_tracks ?? 0;
  const spotifyCount = stats?.spotify_tracks ?? 0;
  const matchedCount = stats?.matched_tracks ?? 0;
  const duplicateGroups = stats?.duplicate_groups ?? 0;

  const matchPct = localCount > 0 ? Math.round((matchedCount / localCount) * 100) : 0;
  const isHealthy = matchPct > 80;
  const lastScanRelative = stats?.last_scan ? relativeTime(stats.last_scan) : "never";

  const localOnly = Math.max(0, localCount - matchedCount);
  const spotifyOnly = Math.max(0, spotifyCount - matchedCount);
  const totalUnique = localOnly + matchedCount + spotifyOnly;
  const localOnlyPct = totalUnique > 0 ? (localOnly / totalUnique) * 100 : 33.3;
  const matchedSegPct = totalUnique > 0 ? (matchedCount / totalUnique) * 100 : 33.3;
  const spotifyOnlyPct = totalUnique > 0 ? (spotifyOnly / totalUnique) * 100 : 33.3;

  const localCoveragePct = localCount > 0 ? Math.round((matchedCount / localCount) * 100) : 0;
  const spotifyCoveragePct = spotifyCount > 0 ? Math.round((matchedCount / spotifyCount) * 100) : 0;

  const taskCards = [
    { label: "MISSING LOCALLY", count: spotifyOnly, color: "#f59e0b", action: "Download or find locally", href: "/sync" },
    { label: "NOT ON SPOTIFY", count: localOnly, color: "#34d399", action: "Like on Spotify", href: "/sync?tab=like" },
    { label: "METADATA DIFFS", count: 0, color: "#8888a0", action: "Review differences", href: "/metadata" },
    { label: "DUPLICATES", count: duplicateGroups, color: "#e05566", action: "Resolve duplicates", href: "/duplicates" },
  ];

  const quickActions = [
    { id: "scan", label: "Scan Library", desc: "Scan local music folders for new or changed tracks", icon: ScanSearch },
    { id: "sync", label: "Sync Spotify", desc: "Pull your latest Spotify liked songs", icon: RefreshCw },
    { id: "match", label: "Run Matching", desc: "Match local tracks to Spotify using ISRC and metadata", icon: GitCompareArrows },
    { id: "backup", label: "Backup", desc: "Sync your library to the backup destination", icon: Archive },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main content column */}
      <div className="flex-[3] min-w-0 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-[28px] font-[800] tracking-[-0.5px] text-[#e0e0e8]">
              {loading ? "--" : matchPct}% SYNCED
            </h1>
            {!loading && isHealthy && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                style={{ color: "#34d399", backgroundColor: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.3)" }}>
                HEALTHY
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#8888a0] mt-1">
            {loading ? "Loading..." : `${localCount.toLocaleString()} local · ${spotifyCount.toLocaleString()} Spotify · last scan ${lastScanRelative}`}
          </p>
        </div>

        {/* Quick Actions — prominent row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            const isRunning = actionLoading === qa.id;
            const progress = actionProgress[qa.id] ?? 0;
            return (
              <button
                key={qa.id}
                onClick={() => handleAction(qa.id)}
                disabled={actionLoading !== null}
                className={`relative overflow-hidden rounded-lg p-4 text-left transition-all duration-200 group border ${
                  isRunning
                    ? "border-[#34d399] bg-[#34d399]"
                    : "border-[rgba(255,255,255,0.06)] bg-[#1c1c28] hover:border-[#34d399]/50 hover:bg-[#24243a] disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {isRunning && (
                  <div className="absolute inset-y-0 left-0 bg-[#2bc48a] transition-all duration-300" style={{ width: `${progress}%` }} />
                )}
                <div className="relative flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isRunning ? "bg-[#12121c]/20" : "bg-[#34d399]/10"
                  }`}>
                    {isRunning
                      ? <Loader2 className="w-5 h-5 text-[#12121c] animate-spin" />
                      : <Icon className="w-5 h-5 text-[#34d399]" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold ${isRunning ? "text-[#12121c]" : "text-[#e0e0e8]"}`}>
                      {isRunning ? `${progress}%` : qa.label}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${isRunning ? "text-[#12121c]/70" : "text-[#5a5a6e] group-hover:text-[#8888a0]"}`}>
                      {isRunning ? `Running ${qa.label.toLowerCase()}...` : qa.desc}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Collection Breakdown Card */}
        <div className="rounded-[4px] p-5" style={{ backgroundColor: "#1c1c28", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex h-[38px] rounded-[4px] overflow-hidden">
            <div className="flex items-center justify-center transition-all duration-500" style={{ width: `${localOnlyPct}%`, backgroundColor: "#2e2e3c" }}>
              {localOnlyPct > 10 && <span className="text-[11px] font-semibold text-[#8888a0]">{localOnly.toLocaleString()}</span>}
            </div>
            <div className="flex items-center justify-center transition-all duration-500" style={{ width: `${matchedSegPct}%`, backgroundColor: "#34d399", boxShadow: "0 0 16px #34d39933" }}>
              {matchedSegPct > 10 && <span className="text-[11px] font-bold text-[#12121c]">{matchedCount.toLocaleString()}</span>}
            </div>
            <div className="flex items-center justify-center transition-all duration-500" style={{ width: `${spotifyOnlyPct}%`, backgroundColor: "#f59e0b", boxShadow: "0 0 16px #f59e0b33" }}>
              {spotifyOnlyPct > 10 && <span className="text-[11px] font-bold text-[#12121c]">{spotifyOnly.toLocaleString()}</span>}
            </div>
          </div>
          <div className="flex gap-5 mt-3 text-[11px] text-[#8888a0]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2e2e3c] inline-block" />Local Only</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#34d399] inline-block" />Matched</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] inline-block" />Spotify Only</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-[#8888a0]">Local library &middot; {localCount.toLocaleString()} &middot; {localCoveragePct}%</span>
              </div>
              <div className="w-full h-[6px] rounded-full bg-[#2e2e3c] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${localCoveragePct}%`, backgroundColor: "#34d399" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-[#8888a0]">Spotify likes &middot; {spotifyCount.toLocaleString()} &middot; {spotifyCoveragePct}%</span>
              </div>
              <div className="w-full h-[6px] rounded-full bg-[#2e2e3c] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${spotifyCoveragePct}%`, backgroundColor: "#f59e0b" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Task Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {taskCards.map((card) => (
            <Link key={card.label} href={card.href}
              className="group rounded-lg p-4 transition-all duration-200 hover:brightness-110"
              style={{ backgroundColor: "#1c1c28", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = card.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
              <div className="text-[28px] font-bold font-mono tracking-[-0.5px]" style={{ color: card.color }}>
                {loading ? "-" : card.count.toLocaleString()}
              </div>
              <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-[#5a5a6e] mt-1">{card.label}</div>
              <div className="text-[11px] mt-2 opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: card.color }}>
                {card.action} &rarr;
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Activity Log sidebar */}
      <div className="flex-[2] min-w-0">
        <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-[#5a5a6e] mb-3">RECENT ACTIVITY</div>
        <div className="rounded-[4px] overflow-hidden" style={{ backgroundColor: "#1c1c28", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="overflow-y-auto max-h-[600px] divide-y divide-[rgba(255,255,255,0.04)]">
            {activities.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-[#5a5a6e]">
                No activity yet. Run an action to get started.
              </div>
            )}
            {activities.map((entry) => {
              const dotColor = COLOR_MAP[entry.color] ?? "#8888a0";
              return (
                <div key={entry.id} className="px-4 py-3 flex gap-3 items-start">
                  <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-[#e0e0e8] font-medium truncate">{entry.action}</div>
                    {entry.detail && (
                      <div className="text-[11px] text-[#5a5a6e] mt-0.5 truncate">{entry.detail}</div>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-[#3a3a4e] shrink-0">{relativeTime(entry.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
