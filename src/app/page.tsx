"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HardDrive,
  Cloud,
  Link2,
  Unlink,
  ScanSearch,
  RefreshCw,
  GitCompareArrows,
  Copy,
  Clock,
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

interface ActivityItem {
  action: string;
  detail: string;
  time: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionProgress, setActionProgress] = useState<Record<string, { current: number; total: number }>>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Stats unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleAction(action: string) {
    setActionLoading(action);
    setActionProgress((prev) => ({ ...prev, [action]: { current: 0, total: 0 } }));
    try {
      let detail = "";
      if (action === "scan") {
        const eventSource = new EventSource("/api/scan/progress");
        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setActionProgress((prev) => ({
              ...prev,
              scan: { current: data.scanned ?? 0, total: data.total ?? 0 },
            }));
          } catch {}
        };
        const res = await fetch("/api/scan", { method: "POST" });
        eventSource.close();
        const data = await res.json();
        detail = `Scanned ${data.total_tracks ?? 0} files`;
      } else if (action === "sync") {
        setActionProgress((prev) => ({ ...prev, sync: { current: 0, total: 1 } }));
        const res = await fetch("/api/spotify/sync", { method: "POST" });
        const data = await res.json();
        setActionProgress((prev) => ({ ...prev, sync: { current: 1, total: 1 } }));
        detail = `Synced ${data.synced ?? data.total ?? 0} tracks`;
      } else if (action === "match") {
        const matchEs = new EventSource("/api/match/progress");
        matchEs.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setActionProgress((prev) => ({
              ...prev,
              match: { current: data.processed ?? 0, total: data.total ?? 0 },
            }));
          } catch {}
        };
        const res = await fetch("/api/match/run", { method: "POST" });
        matchEs.close();
        const data = await res.json();
        detail = `Matched ${data.matched ?? 0} of ${data.total ?? 0} tracks`;
      } else if (action === "duplicates") {
        setActionProgress((prev) => ({ ...prev, duplicates: { current: 0, total: 1 } }));
        const res = await fetch("/api/duplicates", { method: "POST" });
        const data = await res.json();
        setActionProgress((prev) => ({ ...prev, duplicates: { current: 1, total: 1 } }));
        detail = `Found ${data.groups_found ?? 0} duplicate groups`;
      }
      setActivities((prev) => [
        {
          action: actionLabels[action] || action,
          detail,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
      await fetchStats();
    } catch {
      setActivities((prev) => [
        {
          action: actionLabels[action] || action,
          detail: "Failed",
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setActionLoading(null);
      setActionProgress((prev) => {
        const next = { ...prev };
        delete next[action];
        return next;
      });
    }
  }

  const actionLabels: Record<string, string> = {
    scan: "Library Scan",
    sync: "Spotify Sync",
    match: "Track Matching",
    duplicates: "Duplicate Check",
  };

  const localCount = stats?.total_local_tracks ?? 0;
  const spotifyCount = stats?.spotify_tracks ?? 0;
  const matchedCount = stats?.matched_tracks ?? 0;
  const unmatchedCount = stats?.unmatched_tracks ?? 0;
  const total = localCount + spotifyCount;
  const matchPercent = total > 0 ? Math.round((matchedCount / Math.max(localCount, 1)) * 100) : 0;

  const heroStats = [
    {
      label: "Local Tracks",
      value: localCount,
      icon: HardDrive,
      color: "#3B82F6",
    },
    {
      label: "Spotify Liked",
      value: spotifyCount,
      icon: Cloud,
      color: "#22C55E",
    },
    {
      label: "Matched",
      value: matchedCount,
      icon: Link2,
      color: "#A855F7",
    },
    {
      label: "Unmatched",
      value: unmatchedCount,
      icon: Unlink,
      color: "#F59E0B",
    },
  ];

  const quickActions = [
    {
      id: "scan",
      label: "Scan Library",
      description: "Scan local music folders for new or changed tracks",
      icon: ScanSearch,
    },
    {
      id: "sync",
      label: "Sync Spotify",
      description: "Pull your latest Spotify liked songs into the database",
      icon: RefreshCw,
    },
    {
      id: "match",
      label: "Run Matching",
      description: "Match local tracks to Spotify songs using ISRC and metadata",
      icon: GitCompareArrows,
    },
    {
      id: "duplicates",
      label: "Check Duplicates",
      description: "Find duplicate tracks in your local library",
      icon: Copy,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Dashboard</h2>
        <p className="text-sm text-[#94A3B8] mt-1">
          {stats?.last_scan
            ? `Last scan: ${new Date(stats.last_scan).toLocaleString()}`
            : "No scans yet. Start by scanning your library."}
        </p>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {heroStats.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className="bg-[#0F172A] border-[#334155] hover:border-[#475569] transition-all duration-200 hover:shadow-lg hover:shadow-[#000]/20"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-[#94A3B8] text-xs font-medium uppercase tracking-wider">
                  {s.label}
                </CardDescription>
                <Icon
                  className="w-4 h-4"
                  style={{ color: s.color }}
                />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-[#F8FAFC]">
                  {loading ? "-" : s.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Library Overlap */}
      <Card className="bg-[#0F172A] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-[#F8FAFC] text-base">Library Overlap</CardTitle>
          <CardDescription className="text-[#94A3B8]">
            How your local collection and Spotify likes overlap
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stacked bar */}
          {(() => {
            const localOnly = localCount - matchedCount;
            const spotifyOnly = spotifyCount - matchedCount;
            const totalUnique = localOnly + matchedCount + spotifyOnly;
            const localOnlyPct = totalUnique > 0 ? (localOnly / totalUnique) * 100 : 0;
            const matchedPct = totalUnique > 0 ? (matchedCount / totalUnique) * 100 : 0;
            const spotifyOnlyPct = totalUnique > 0 ? (spotifyOnly / totalUnique) * 100 : 0;
            const spotifyMatchPct = spotifyCount > 0 ? Math.round((matchedCount / spotifyCount) * 100) : 0;

            return (
              <>
                {/* Bar */}
                <div className="w-full h-8 rounded-full overflow-hidden flex bg-[#1E293B]">
                  <div
                    className="h-full bg-[#3B82F6] transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${localOnlyPct}%` }}
                  >
                    {localOnlyPct > 8 && (
                      <span className="text-[10px] font-semibold text-white">{localOnly.toLocaleString()}</span>
                    )}
                  </div>
                  <div
                    className="h-full bg-[#A855F7] transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${matchedPct}%` }}
                  >
                    {matchedPct > 8 && (
                      <span className="text-[10px] font-semibold text-white">{matchedCount.toLocaleString()}</span>
                    )}
                  </div>
                  <div
                    className="h-full bg-[#22C55E] transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${spotifyOnlyPct}%` }}
                  >
                    {spotifyOnlyPct > 8 && (
                      <span className="text-[10px] font-semibold text-white">{spotifyOnly.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Legend + Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
                      <span className="text-xs text-[#94A3B8]">Local Only</span>
                    </div>
                    <p className="text-xl font-bold text-[#3B82F6]">{loading ? "-" : localOnly.toLocaleString()}</p>
                    <p className="text-[10px] text-[#64748B]">not on Spotify</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#A855F7]" />
                      <span className="text-xs text-[#94A3B8]">Matched</span>
                    </div>
                    <p className="text-xl font-bold text-[#A855F7]">{loading ? "-" : matchedCount.toLocaleString()}</p>
                    <p className="text-[10px] text-[#64748B]">{spotifyMatchPct}% of Spotify liked</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#22C55E]" />
                      <span className="text-xs text-[#94A3B8]">Spotify Only</span>
                    </div>
                    <p className="text-xl font-bold text-[#22C55E]">{loading ? "-" : spotifyOnly.toLocaleString()}</p>
                    <p className="text-[10px] text-[#64748B]">need to download</p>
                  </div>
                </div>

                {/* Per-library coverage bars */}
                <div className="space-y-3 pt-2 border-t border-[#1E293B]">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#94A3B8]">Local library coverage</span>
                      <span className="text-[#F8FAFC] tabular-nums">{matchPercent}% matched</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#1E293B] overflow-hidden">
                      <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-500" style={{ width: `${matchPercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#94A3B8]">Spotify library coverage</span>
                      <span className="text-[#F8FAFC] tabular-nums">{spotifyMatchPct}% matched</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#1E293B] overflow-hidden">
                      <div className="h-full bg-[#22C55E] rounded-full transition-all duration-500" style={{ width: `${spotifyMatchPct}%` }} />
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isThisLoading = actionLoading === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                disabled={actionLoading !== null}
                className="group text-left bg-[#0F172A] border border-[#334155] rounded-lg p-4 transition-all duration-200 hover:border-[#22C55E]/40 hover:shadow-lg hover:shadow-[#22C55E]/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3 mb-2">
                  {isThisLoading ? (
                    <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-[#64748B] group-hover:text-[#22C55E] transition-colors duration-200" />
                  )}
                  <span className="text-sm font-semibold text-[#F8FAFC]">
                    {isThisLoading ? "Running..." : action.label}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {action.description}
                </p>
                {isThisLoading && actionProgress[action.id] && (
                  <div className="mt-3 space-y-1">
                    <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22C55E] rounded-full transition-all duration-300"
                        style={{
                          width: `${actionProgress[action.id].total > 0
                            ? Math.round((actionProgress[action.id].current / actionProgress[action.id].total) * 100)
                            : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#64748B] tabular-nums">
                      {actionProgress[action.id].current.toLocaleString()}
                      {actionProgress[action.id].total > 0 && ` / ${actionProgress[action.id].total.toLocaleString()}`}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {activities.length > 0 && (
        <Card className="bg-[#0F172A] border-[#334155]">
          <CardHeader>
            <CardTitle className="text-[#F8FAFC] text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#64748B]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.map((activity, i) => (
                <div
                  key={`${activity.time}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-[#1E293B] last:border-0"
                >
                  <div>
                    <span className="text-sm font-medium text-[#F8FAFC]">
                      {activity.action}
                    </span>
                    <span className="text-sm text-[#64748B] ml-2">
                      {activity.detail}
                    </span>
                  </div>
                  <span className="text-xs text-[#475569]">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
