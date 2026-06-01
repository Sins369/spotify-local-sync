"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, RefreshCw, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DuplicateMember {
  id: number;
  group_id: number;
  local_track_id: number;
  is_keeper: number;
  quality_score: number | null;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  codec: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
}

interface DuplicateGroupData {
  id: number;
  resolution: string | null;
  members: DuplicateMember[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBitrate(bitrate: number): string {
  if (bitrate > 10000) return `${Math.round(bitrate / 1000)} kbps`;
  return `${bitrate} kbps`;
}

function getLastFourSegments(path: string): string {
  return path.split(/[\\/]/).slice(-4, -1).join("/");
}

function qualityPercent(score: number | null): string {
  if (score === null) return "—";
  if (score <= 1) return `${Math.round(score * 100)}%`;
  return `${Math.round(score)}%`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await fetch("/api/duplicates");
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : data.groups ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  async function runDetection() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/duplicates", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setScanResult(
          `Found ${data.groups_found ?? 0} groups with ${data.total_duplicate_tracks ?? 0} tracks`
        );
      }
      await fetchGroups();
    } catch {
      setScanResult("Detection failed");
    } finally {
      setScanning(false);
    }
  }

  function stopPlayback() {
    const current = audioRef.current;
    if (current) {
      current.pause();
      current.removeAttribute("src");
      current.load();
    }
    audioRef.current = null;
    setPlayingId(null);
  }

  function togglePlay(member: DuplicateMember) {
    if (playingId === member.id) {
      stopPlayback();
      return;
    }

    stopPlayback();

    const audio = new Audio();
    audio.preload = "auto";
    audio.onended = () => {
      audioRef.current = null;
      setPlayingId(null);
    };
    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      audioRef.current = null;
      setPlayingId(null);
    };
    audio.src = `/api/preview?path=${encodeURIComponent(member.path)}`;
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;
    setPlayingId(member.id);
    audio.play().catch((err) => {
      console.error("Play failed:", err);
      setPlayingId(null);
      audioRef.current = null;
    });
  }

  async function handleResolve(groupId: number, action: string, keepId?: number) {
    stopPlayback();
    setResolving(true);
    try {
      await fetch("/api/duplicates/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId, action, keeper_track_id: keepId }),
      });
      await fetchGroups();
    } catch {
      // Resolve failed
    } finally {
      setResolving(false);
    }
  }

  // ── Loading state ──

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <h1
          className="font-[800]"
          style={{ fontSize: "22px", color: "#e0e0e8" }}
        >
          Duplicates
        </h1>
        <p style={{ fontSize: "14px", color: "#8888a0" }}>Loading...</p>
      </div>
    );
  }

  const totalTracks = groups.reduce((sum, g) => sum + g.members.length, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="font-[800]"
            style={{ fontSize: "22px", color: "#e0e0e8" }}
          >
            Duplicates
          </h1>
          <p className="mt-1" style={{ fontSize: "14px", color: "#8888a0" }}>
            {groups.length} group{groups.length !== 1 ? "s" : ""} &middot;{" "}
            {totalTracks} total tracks
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#24243a", color: "#e0e0e8" }}
          onMouseEnter={(e) => {
            if (!scanning) {
              e.currentTarget.style.backgroundColor = "#34d399";
              e.currentTarget.style.color = "#12121c";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#24243a";
            e.currentTarget.style.color = "#e0e0e8";
          }}
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {scanning ? "Scanning..." : "Re-scan"}
        </button>
      </div>

      {/* ── Scan progress ── */}
      {scanning && (
        <div className="space-y-2">
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "#24243a" }}
          >
            <div
              className="h-full rounded-full animate-pulse w-full"
              style={{ backgroundColor: "#34d399" }}
            />
          </div>
          <p style={{ fontSize: "12px", color: "#5a5a6e" }}>
            Scanning library for duplicates...
          </p>
        </div>
      )}

      {/* ── Scan result ── */}
      {scanResult && !scanning && (
        <p style={{ fontSize: "14px", color: "#34d399" }}>{scanResult}</p>
      )}

      {/* ── Empty state ── */}
      {groups.length === 0 && !scanning ? (
        <p style={{ color: "#5a5a6e" }}>
          No duplicate groups found. Click Re-scan to check your library.
        </p>
      ) : (
        /* ── Card grid ── */
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {groups.map((group) => {
            const sorted = [...group.members].sort(
              (a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0)
            );
            const bestId = sorted[0]?.local_track_id;
            const title = sorted[0]?.title ?? "Unknown";
            const artist = sorted[0]?.artist ?? "Unknown";

            const titlesMatch = sorted.every(
              (m) =>
                m.title?.toLowerCase() === sorted[0]?.title?.toLowerCase()
            );
            const albumsMatch = sorted.every(
              (m) =>
                m.album?.toLowerCase() === sorted[0]?.album?.toLowerCase()
            );
            const sizeDiff =
              sorted.length >= 2
                ? Math.abs(
                    (sorted[0].size_bytes ?? 0) -
                      (sorted[sorted.length - 1].size_bytes ?? 0)
                  )
                : 0;
            const needsReview =
              !titlesMatch || (!albumsMatch && sizeDiff > 5 * 1024 * 1024);

            return (
              <div
                key={group.id}
                style={{
                  backgroundColor: "#1c1c28",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "4px",
                  padding: "16px",
                }}
              >
                {/* ── Card header ── */}
                <div className="flex items-center gap-2 mb-1">
                  <p
                    className="truncate"
                    style={{ fontSize: "14px", color: "#e0e0e8" }}
                  >
                    {title}{" "}
                    <span style={{ color: "#8888a0", fontWeight: 400 }}>
                      by {artist}
                    </span>
                  </p>
                  {needsReview && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: "#f59e0b20",
                        color: "#f59e0b",
                      }}
                    >
                      Review
                    </span>
                  )}
                </div>
                {needsReview && (
                  <p
                    className="mb-3"
                    style={{
                      fontSize: "10px",
                      color: "#f59e0b",
                      opacity: 0.7,
                    }}
                  >
                    {!titlesMatch
                      ? "Titles differ — may be different tracks"
                      : "Different albums with large file size gap"}
                  </p>
                )}

                {/* ── Members ── */}
                <div className="space-y-2 mt-3">
                  {sorted.map((member) => {
                    const isBest = member.local_track_id === bestId;
                    const isPlaying = playingId === member.id;
                    const isFlac =
                      member.codec?.toUpperCase() === "FLAC";

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 rounded p-3"
                        style={{
                          border: isBest
                            ? "1px solid rgba(52,211,153,0.3)"
                            : "1px solid rgba(255,255,255,0.04)",
                          backgroundColor: isBest
                            ? "rgba(52,211,153,0.04)"
                            : "#12121c",
                        }}
                      >
                        {/* Play/Pause button */}
                        <button
                          onClick={() => togglePlay(member)}
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                          style={{ backgroundColor: "#24243a" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "#34d399";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "#24243a";
                          }}
                        >
                          {isPlaying ? (
                            <Pause
                              className="w-3.5 h-3.5"
                              style={{ color: "#34d399" }}
                            />
                          ) : (
                            <Play
                              className="w-3.5 h-3.5 ml-0.5"
                              style={{ color: "#8888a0" }}
                            />
                          )}
                        </button>

                        {/* Member info */}
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Path */}
                          <p
                            className="font-mono truncate"
                            style={{ fontSize: "10px", color: "#5a5a6e" }}
                            title={member.path}
                          >
                            {getLastFourSegments(member.path)}
                          </p>

                          {/* Stats row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Format badge */}
                            {member.codec && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                style={
                                  isFlac
                                    ? {
                                        backgroundColor: "#34d39920",
                                        color: "#34d399",
                                      }
                                    : {
                                        backgroundColor: "#24243a",
                                        color: "#8888a0",
                                      }
                                }
                              >
                                {member.codec.toUpperCase()}
                              </span>
                            )}
                            {member.size_bytes !== null && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#8888a0",
                                }}
                              >
                                {formatSize(member.size_bytes)}
                              </span>
                            )}
                            {member.bitrate !== null && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#8888a0",
                                }}
                              >
                                {formatBitrate(member.bitrate)}
                              </span>
                            )}
                            {/* Quality score */}
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#8888a0",
                              }}
                            >
                              {qualityPercent(member.quality_score)}
                            </span>
                            {/* BEST indicator or Keep button */}
                            {isBest ? (
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: "#34d399" }}
                                />
                                <span
                                  className="font-medium"
                                  style={{
                                    fontSize: "10px",
                                    color: "#34d399",
                                  }}
                                >
                                  BEST
                                </span>
                              </span>
                            ) : (
                              <button
                                disabled={resolving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopPlayback();
                                  handleResolve(group.id, "keep_one", member.local_track_id);
                                }}
                                className="font-medium transition-colors disabled:opacity-50"
                                style={{ fontSize: "10px", color: "#8888a0" }}
                                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#34d399"; }}
                                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#8888a0"; }}
                              >
                                Keep this
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Actions (text links) ── */}
                <div
                  className="flex items-center mt-4 flex-wrap"
                  style={{ fontSize: "13px" }}
                >
                  <button
                    disabled={resolving}
                    onClick={() =>
                      handleResolve(group.id, "keep_one", bestId)
                    }
                    className="bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50"
                    style={{ color: "#8888a0", padding: 0 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#e0e0e8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#8888a0";
                    }}
                  >
                    Keep best
                  </button>
                  <span
                    className="mx-2"
                    style={{ color: "#5a5a6e" }}
                  >
                    &middot;
                  </span>
                  <button
                    disabled={resolving}
                    onClick={() => handleResolve(group.id, "keep_all")}
                    className="bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50"
                    style={{ color: "#8888a0", padding: 0 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#e0e0e8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#8888a0";
                    }}
                  >
                    Keep all
                  </button>
                  <span
                    className="mx-2"
                    style={{ color: "#5a5a6e" }}
                  >
                    &middot;
                  </span>
                  <button
                    disabled={resolving}
                    onClick={() => handleResolve(group.id, "ignore")}
                    className="bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50"
                    style={{ color: "#8888a0", padding: 0 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#e0e0e8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#8888a0";
                    }}
                  >
                    Not duplicates
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
