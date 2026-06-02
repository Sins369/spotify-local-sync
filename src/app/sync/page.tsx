"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Download,
  Heart,
  Search,
  GitCompareArrows,
  Loader2,
  AlertCircle,
  Music,
  Check,
  ExternalLink,
  X,
  ArrowRight,
  RefreshCw,
  Play,
  Pause,
} from "lucide-react";
import type { SoulseekResult } from "@/types";

interface SpotifyTrack {
  id: number;
  spotify_id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_art_url: string | null;
  synced_at?: string;
}

interface LocalTrack {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  path: string;
  uri?: string;
}

interface QueueItem {
  id: number;
  title: string;
  status: string;
}

interface QueueStats {
  active: number;
  queued: number;
  completed: number;
  failed: number;
  total: number;
}

type QualityPreference = "flac" | "mp3" | "any";
type SortOption = "newest" | "oldest" | "title" | "artist" | "album";

export default function SyncPage() {
  const [missingLocally, setMissingLocally] = useState<SpotifyTrack[]>([]);
  const [missingOnSpotify, setMissingOnSpotify] = useState<LocalTrack[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingSpotify, setLoadingSpotify] = useState(true);
  const [hasMatches, setHasMatches] = useState<boolean | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [tab, setTab] = useState<"download" | "like">("download");
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());
  const [searchCache, setSearchCache] = useState<Map<number, SoulseekResult[]>>(new Map());
  const [qualityPref, setQualityPref] = useState<QualityPreference>("any");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ searched: number; queued: number; noResults: number; total: number } | null>(null);
  const [bulkTrackStatus, setBulkTrackStatus] = useState<Map<number, "searching" | "queued" | "no_results">>(new Map());
  const [batchSize, setBatchSize] = useState<number | "all">(25);

  const fetchMissingLocally = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch("/api/match/results?filter=missing_locally");
      if (res.ok) setMissingLocally(await res.json());
    } catch {} finally { setLoadingLocal(false); }
  }, []);

  const fetchMissingOnSpotify = useCallback(async () => {
    setLoadingSpotify(true);
    try {
      const res = await fetch("/api/match/results?filter=missing_on_spotify");
      if (res.ok) setMissingOnSpotify(await res.json());
    } catch {} finally { setLoadingSpotify(false); }
  }, []);

  const checkMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/stats");
      if (res.ok) {
        const data = await res.json();
        setHasMatches(data.matched_tracks > 0);
      }
    } catch {}
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/soulseek/queue");
      if (res.ok) {
        const data = await res.json();
        setQueueStats(data.stats ?? null);
        const downloads = data.downloads ?? [];
        const recent = downloads.slice(-5).map((d: { id: number; status: string; filename?: string }) => ({
          id: d.id,
          title: d.filename?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? `Download #${d.id}`,
          status: d.status,
        }));
        setQueueItems(recent);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchMissingLocally();
    fetchMissingOnSpotify();
    checkMatches();
    fetchQueue();
    fetch("/api/soulseek/connect", { method: "POST" }).catch(() => {});

    // Check if bulk download is already running (e.g. after navigation)
    fetch("/api/soulseek/bulk-progress").then(res => {
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      reader.read().then(({ value, done }) => {
        if (done || !value) return;
        reader.cancel();
        try {
          const text = decoder.decode(value);
          const match = text.match(/data: (.+)/);
          if (match) {
            const data = JSON.parse(match[1]);
            if (data.type === "progress" && data.total > 0) {
              setBulkRunning(true);
              setBulkProgress(data);
              connectBulkSSE();
            }
          }
        } catch {}
      });
    }).catch(() => {});

    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [fetchMissingLocally, fetchMissingOnSpotify, checkMatches, fetchQueue]);

  const filteredLocal = missingLocally.filter((t) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q) || t.album?.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortBy === "newest") return a.id - b.id;
    if (sortBy === "oldest") return b.id - a.id;
    if (sortBy === "title") return (a.title ?? "").localeCompare(b.title ?? "");
    if (sortBy === "artist") return (a.artist ?? "").localeCompare(b.artist ?? "");
    if (sortBy === "album") return (a.album ?? "").localeCompare(b.album ?? "");
    return 0;
  });

  async function handleRunMatching() {
    setMatchLoading(true);
    setMatchResult(null);
    try {
      const res = await fetch("/api/match/run", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMatchResult(`Matched ${data.matched} of ${data.total} tracks`);
        await Promise.all([fetchMissingLocally(), fetchMissingOnSpotify(), checkMatches()]);
      }
    } catch {} finally { setMatchLoading(false); }
  }

  function handleDownloaded(trackId: number) {
    setDownloadedIds((prev) => new Set(prev).add(trackId));
    fetchQueue();
    // Auto-advance to next unqueued track
    const currentIdx = filteredLocal.findIndex((t) => t.id === trackId);
    if (currentIdx >= 0) {
      const nextTrack = filteredLocal.slice(currentIdx + 1).find((t) => !downloadedIds.has(t.id));
      if (nextTrack) {
        setSelectedTrack(nextTrack);
      }
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function connectBulkSSE() {
    const es = new EventSource("/api/soulseek/bulk-progress");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "searching") setBulkTrackStatus(prev => new Map(prev).set(data.trackId, "searching"));
        else if (data.type === "queued") {
          setBulkTrackStatus(prev => new Map(prev).set(data.trackId, "queued"));
          setDownloadedIds(prev => new Set(prev).add(data.trackId));
        } else if (data.type === "no_results") setBulkTrackStatus(prev => new Map(prev).set(data.trackId, "no_results"));
        else if (data.type === "progress") setBulkProgress(data);
        else if (data.type === "done") {
          es.close(); setBulkRunning(false); setSelectedIds(new Set());
          fetchMissingLocally(); fetchQueue();
        }
      } catch {}
    };
    es.onerror = () => { es.close(); };
  }

  async function startBulkDownload(trackIds?: number[]) {
    setBulkRunning(true);
    setBulkProgress(null);
    setBulkTrackStatus(new Map());
    const body: Record<string, unknown> = { qualityPref, batchSize };
    if (trackIds && trackIds.length > 0) body.trackIds = trackIds;
    const res = await fetch("/api/soulseek/bulk-download", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) { setBulkRunning(false); return; }
    connectBulkSSE();
  }

  const showQueue = queueStats && queueStats.total > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] relative">
      {/* Header */}
      <div className="shrink-0 mb-6">
        <h2 className="text-[22px] font-[800] text-[#e0e0e8]">Sync</h2>
        <p className="text-sm text-[#8888a0] mt-1">Download missing tracks and like local songs on Spotify</p>
      </div>

      {/* Match warning */}
      {hasMatches === false && (
        <div className="shrink-0 mb-4 flex items-center justify-between p-4 rounded-lg bg-[#1c1c28] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#f59e0b]" />
            <p className="text-sm text-[#e0e0e8]">Run matching first to find gaps</p>
          </div>
          <button onClick={handleRunMatching} disabled={matchLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#34d399] text-[#12121c] text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all">
            {matchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
            {matchLoading ? "Running..." : "Run Matching"}
          </button>
        </div>
      )}
      {matchResult && <p className="text-sm text-[#34d399] shrink-0 mb-4">{matchResult}</p>}

      {/* Underline Tabs */}
      <div className="shrink-0 flex gap-6 border-b border-[rgba(255,255,255,0.06)] mb-5">
        <button
          onClick={() => { setTab("download"); setSelectedTrack(null); }}
          className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative ${
            tab === "download"
              ? "text-[#f59e0b]"
              : "text-[#5a5a6e] hover:text-[#8888a0]"
          }`}
        >
          <Download className="w-4 h-4" />
          Missing Locally
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            tab === "download" ? "bg-[#f59e0b]/20 text-[#f59e0b]" : "bg-[#24243a] text-[#8888a0]"
          }`}>{filteredLocal.length}</span>
          {tab === "download" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f59e0b]" />}
        </button>
        <button
          onClick={() => { setTab("like"); setSelectedTrack(null); }}
          className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative ${
            tab === "like"
              ? "text-[#34d399]"
              : "text-[#5a5a6e] hover:text-[#8888a0]"
          }`}
        >
          <Heart className="w-4 h-4" />
          Not on Spotify
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            tab === "like" ? "bg-[#34d399]/20 text-[#34d399]" : "bg-[#24243a] text-[#8888a0]"
          }`}>{missingOnSpotify.length}</span>
          {tab === "like" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#34d399]" />}
        </button>
      </div>

      {/* Download Tab */}
      {tab === "download" && (
        <>
        {/* Bulk Action Bar */}
        {bulkRunning && bulkProgress ? (
          <div className="shrink-0 mb-3 p-3 rounded-lg bg-[#1c1c28] border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[#e0e0e8]">
                Searching {bulkProgress.searched}/{bulkProgress.total}...
                {bulkProgress.queued > 0 && ` · ${bulkProgress.queued} queued`}
                {bulkProgress.noResults > 0 && ` · ${bulkProgress.noResults} unavailable`}
              </span>
              <button onClick={() => fetch("/api/soulseek/bulk-cancel", { method: "POST" })} className="text-[11px] text-[#e05566] hover:underline">Cancel</button>
            </div>
            <div className="w-full h-1.5 bg-[#24243a] rounded-full overflow-hidden">
              <div className="h-full bg-[#34d399] rounded-full transition-all duration-300"
                style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.searched / bulkProgress.total) * 100 : 0}%` }} />
            </div>
          </div>
        ) : (
          <div className="shrink-0 mb-3 flex items-center gap-3 flex-wrap">
            <button onClick={() => setSelectedIds(new Set(filteredLocal.map(t => t.id)))} className="text-[11px] text-[#8888a0] hover:text-[#e0e0e8]">Select all</button>
            <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-[#8888a0] hover:text-[#e0e0e8]">Deselect all</button>
            <select value={String(batchSize)} onChange={(e) => setBatchSize(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="bg-[#141420] border border-[rgba(255,255,255,0.06)] text-[11px] text-[#8888a0] rounded px-2 py-1 outline-none">
              <option value="10">10 tracks</option>
              <option value="25">25 tracks</option>
              <option value="50">50 tracks</option>
              <option value="all">All tracks</option>
            </select>
            <div className="flex-1" />
            {selectedIds.size > 0 && (
              <button onClick={() => startBulkDownload([...selectedIds])}
                className="px-3 py-1.5 rounded bg-[#34d399] text-[#12121c] text-[12px] font-semibold hover:brightness-110 transition-all">
                Download {selectedIds.size} Selected
              </button>
            )}
            <button onClick={() => startBulkDownload()}
              className="px-3 py-1.5 rounded bg-[#24243a] text-[#e0e0e8] text-[12px] font-medium hover:bg-[#34d399] hover:text-[#12121c] transition-all">
              {batchSize === "all" ? "Download All" : `Download Next ${batchSize}`}
            </button>
          </div>
        )}
        <div className="flex-1 flex min-h-0 gap-0 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.06)]">
          {/* Left Panel */}
          <div className="w-[35%] min-w-[280px] max-w-[400px] shrink-0 flex flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#1c1c28]">
            {/* Search */}
            <div className="p-3 space-y-3 shrink-0 border-b border-[rgba(255,255,255,0.06)]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e]" />
                <input
                  type="text"
                  placeholder="Search tracks..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-[#141420] border border-[rgba(255,255,255,0.06)] text-sm text-[#e0e0e8] placeholder-[#5a5a6e] outline-none focus:border-[#34d399]/40 transition-colors"
                />
              </div>
              {/* Quality + Sort row */}
              <div className="flex gap-2 items-center">
                <div className="flex gap-1 flex-1">
                  {(["flac", "mp3", "any"] as QualityPreference[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQualityPref(q)}
                      className={`flex-1 px-2 py-1.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                        qualityPref === q
                          ? "bg-[#34d399] text-[#12121c]"
                          : "bg-[#24243a] text-[#8888a0] hover:text-[#e0e0e8]"
                      }`}
                    >
                      {q}
                  </button>
                ))}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-[#141420] border border-[rgba(255,255,255,0.06)] text-[10px] text-[#8888a0] rounded px-2 py-1.5 outline-none focus:border-[#34d399]/40 transition-colors"
                >
                  <option value="newest">Newest Liked</option>
                  <option value="oldest">Oldest Liked</option>
                  <option value="title">Title</option>
                  <option value="artist">Artist</option>
                  <option value="album">Album</option>
                </select>
              </div>
            </div>

            {/* Track list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingLocal ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 text-[#34d399] animate-spin" />
                </div>
              ) : filteredLocal.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Music className="w-8 h-8 text-[#24243a] mb-2" />
                  <p className="text-xs text-[#5a5a6e]">
                    {missingLocally.length === 0 ? "All synced!" : "No matches for filter"}
                  </p>
                </div>
              ) : (
                <div className="p-1">
                  {filteredLocal.map((track) => {
                    const isSelected = selectedTrack?.id === track.id;
                    const isQueued = downloadedIds.has(track.id);
                    return (
                      <button
                        key={`t-${track.id}`}
                        onClick={() => setSelectedTrack(track)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-md transition-all ${
                          isSelected
                            ? "bg-[#24243a] border-l-[3px] border-l-[#f59e0b]"
                            : "border-l-[3px] border-l-transparent hover:bg-[#24243a]/50"
                        } ${isQueued || bulkTrackStatus.get(track.id) === "queued" ? "opacity-50" : ""}`}
                      >
                        <input type="checkbox" checked={selectedIds.has(track.id)}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(track.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 accent-[#34d399] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] text-[#e0e0e8] truncate">{track.title ?? "Unknown"}</p>
                          <p className="text-[12px] text-[#8888a0] truncate">{track.artist ?? "Unknown"}</p>
                        </div>
                        {bulkTrackStatus.get(track.id) === "searching" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-semibold uppercase shrink-0 animate-pulse">Searching</span>
                        )}
                        {bulkTrackStatus.get(track.id) === "no_results" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#24243a] text-[#5a5a6e] font-semibold uppercase shrink-0">No results</span>
                        )}
                        {(isQueued || bulkTrackStatus.get(track.id) === "queued") && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#34d399]/20 text-[#34d399] font-semibold uppercase shrink-0">Queued</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#12121c]">
            {selectedTrack ? (
              <DetailPanel
                track={selectedTrack}
                cachedResults={searchCache.get(selectedTrack.id)}
                qualityPref={qualityPref}
                onDownloaded={() => handleDownloaded(selectedTrack.id)}
                onClose={() => setSelectedTrack(null)}
                onCacheResults={(id, results) => setSearchCache((prev) => new Map(prev).set(id, results))}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Music className="w-12 h-12 text-[#24243a] mb-3" />
                <p className="text-[#5a5a6e]">Select a track to preview and download</p>
                <p className="text-xs text-[#5a5a6e]/60 mt-1">Click any track on the left to get started</p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Like Tab */}
      {tab === "like" && (
        <LikeSection
          tracks={missingOnSpotify}
          loading={loadingSpotify}
        />
      )}

      {/* Persistent Download Queue Bar */}
      {showQueue && (
        <div className="shrink-0 mt-4 bg-[#161620] border-t border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3 flex items-center gap-4">
          {/* Left label */}
          <span className="text-[10px] uppercase tracking-wider text-[#8888a0] font-semibold shrink-0">
            Download Queue &middot; {queueStats.completed}/{queueStats.total} complete
          </span>

          {/* Middle: recent items */}
          <div className="flex-1 overflow-x-auto flex gap-3 min-w-0">
            {queueItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#e0e0e8] truncate max-w-[120px]">{item.title}</span>
                <QueueStatusBadge status={item.status} />
              </div>
            ))}
          </div>

          {/* Right link */}
          <Link href="/downloads" className="flex items-center gap-1 text-[13px] text-[#34d399] hover:underline shrink-0 font-medium">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function QueueStatusBadge({ status }: { status: string }) {
  let bg = "bg-[#24243a]";
  let text = "text-[#8888a0]";
  if (status === "complete") { bg = "bg-[#34d399]/20"; text = "text-[#34d399]"; }
  else if (status === "downloading") { bg = "bg-[#f59e0b]/20"; text = "text-[#f59e0b]"; }
  else if (status === "failed") { bg = "bg-[#e05566]/20"; text = "text-[#e05566]"; }
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${bg} ${text}`}>
      {status}
    </span>
  );
}

function DetailPanel({ track, cachedResults, qualityPref, onDownloaded, onClose, onCacheResults }: {
  track: SpotifyTrack;
  cachedResults?: SoulseekResult[];
  qualityPref: QualityPreference;
  onDownloaded: () => void;
  onClose: () => void;
  onCacheResults: (id: number, results: SoulseekResult[]) => void;
}) {
  const [results, setResults] = useState<SoulseekResult[]>(cachedResults ?? []);
  const [searching, setSearching] = useState(!cachedResults);
  const [searched, setSearched] = useState(!!cachedResults);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedUsers, setFailedUsers] = useState<Set<string>>(new Set());
  const prevTrackId = useRef<number | null>(null);

  useEffect(() => {
    if (track.id !== prevTrackId.current) {
      prevTrackId.current = track.id;
      setDownloaded(false);
      setError(null);
      setDownloading(null);

      fetch(`/api/soulseek/failed-users?track_id=${track.id}`)
        .then((r) => r.ok ? r.json() : [])
        .then((users: string[]) => setFailedUsers(new Set(users)))
        .catch(() => {});

      if (cachedResults) {
        setResults(cachedResults);
        setSearched(true);
        setSearching(false);
      } else {
        setResults([]);
        setSearched(false);
        handleSearch();
      }
    }
  }, [track.id, cachedResults]);

  async function handleSearch() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/soulseek/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${track.artist} ${track.title}` }),
      });
      if (res.ok) {
        const data = await res.json();
        const all: SoulseekResult[] = Array.isArray(data) ? data : data.results ?? [];
        const trimmed = all.slice(0, 30);
        setResults(trimmed);
        onCacheResults(track.id, trimmed);
      } else {
        const data = await res.json();
        setError(data.error || "Search failed");
      }
      setSearched(true);
    } catch {
      setError("Search failed -- is Soulseek connected?");
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleDownload(result: SoulseekResult) {
    setDownloading(result.file);
    setError(null);
    try {
      const res = await fetch("/api/soulseek/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_track_id: track.id,
          username: result.username,
          file: result.file,
          file_size: result.size,
          format: result.format,
          bitrate: result.bitrate,
        }),
      });
      if (res.ok) {
        setDownloaded(true);
        onDownloaded();
      } else {
        const data = await res.json();
        setError(data.error || "Download failed -- try another user");
      }
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(null);
    }
  }

  function handleBestMatch() {
    const preferredResults = results.filter((r) => !failedUsers.has(r.username));
    let match: SoulseekResult | undefined;
    if (qualityPref === "flac") {
      match = preferredResults.find((r) => r.format === "flac");
    } else if (qualityPref === "mp3") {
      match = preferredResults.find((r) => r.format === "mp3");
    }
    if (!match) {
      match = preferredResults[0];
    }
    if (match) handleDownload(match);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isPreferred(result: SoulseekResult): boolean {
    if (qualityPref === "any") return false;
    return result.format === qualityPref;
  }

  function togglePreview() {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.onended = () => { setPlaying(false); audioRef.current = null; };
    audio.onerror = () => { setPlaying(false); audioRef.current = null; };
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = audio;
    setPlaying(true);
    audio.play().catch(() => setPlaying(false));
  }

  const [albumArt, setAlbumArt] = useState<string | null>(track.album_art_url ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAlbumArt(track.album_art_url ?? null);
    setPreviewUrl(null);
    setPreviewSource(null);
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (track.spotify_id) {
      if (!track.album_art_url) {
        fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${track.spotify_id}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.thumbnail_url) setAlbumArt(data.thumbnail_url); })
          .catch(() => {});
      }
      fetch(`/api/spotify/preview?id=${track.spotify_id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.preview_url) {
            setPreviewUrl(data.preview_url);
            setPreviewSource(data.source);
          }
        })
        .catch(() => {});
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [track.id]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 flex flex-col p-5 space-y-4 overflow-y-auto min-h-0">
        {/* Track header + Spotify preview combined */}
        <div className="shrink-0 rounded-lg bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <div className="flex items-start gap-4 p-4">
            {albumArt ? (
              <img src={albumArt} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 shadow-lg" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-[#24243a] flex items-center justify-center shrink-0">
                <Music className="w-6 h-6 text-[#5a5a6e]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-[#e0e0e8] truncate">{track.title}</h3>
              <p className="text-sm text-[#8888a0]">{track.artist}</p>
              <p className="text-xs text-[#5a5a6e]">{track.album}</p>
            </div>
            <button onClick={onClose} className="shrink-0 p-1.5 rounded hover:bg-[#24243a] text-[#5a5a6e] hover:text-[#e0e0e8] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {track.spotify_id && (
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[rgba(255,255,255,0.06)]">
              <button
                onClick={togglePreview}
                disabled={!previewUrl}
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  playing
                    ? "bg-[#1DB954] text-white shadow-[0_0_12px_#1DB95444]"
                    : previewUrl
                      ? "bg-[#24243a] text-[#e0e0e8] hover:bg-[#1DB954] hover:text-white"
                      : "bg-[#24243a] text-[#3a3a4e] cursor-not-allowed"
                }`}
                title={!previewUrl ? "No preview available" : playing ? "Pause preview" : "Play 30s preview"}
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#8888a0]">
                  {!previewUrl
                    ? "Loading preview..."
                    : playing
                      ? "Playing 30s preview..."
                      : `30s preview${previewSource === "itunes" ? " via Apple Music" : ""}`}
                </p>
              </div>
              <a
                href={`https://open.spotify.com/track/${track.spotify_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[11px] text-[#1DB954] hover:underline flex items-center gap-1"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Best match button — visible during and after search */}
        {!downloaded && (
          <button
            onClick={handleBestMatch}
            disabled={downloading !== null || searching || results.length === 0}
            className="shrink-0 w-full py-2.5 rounded-lg bg-[#34d399] text-[#12121c] text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching for best match...
              </>
            ) : results.length === 0 && searched ? (
              "No results found"
            ) : (
              "Best match"
            )}
          </button>
        )}

        {/* Status messages */}
        {downloaded && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#34d399]/10 border border-[#34d399]/20 shrink-0">
            <Check className="w-5 h-5 text-[#34d399]" />
            <p className="text-sm font-medium text-[#34d399] flex-1">Queued for download</p>
            <Link href="/downloads" className="text-xs text-[#34d399] hover:underline flex items-center gap-1">
              View <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#e05566]/10 border border-[#e05566]/20 shrink-0">
            <X className="w-4 h-4 text-[#e05566] shrink-0" />
            <p className="text-xs text-[#e05566] flex-1">{error}</p>
            <button onClick={handleSearch} className="text-xs text-[#e05566] hover:underline font-medium">Retry</button>
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between shrink-0">
          <h4 className="text-[10px] font-semibold text-[#8888a0] uppercase tracking-wider">
            {searching ? "Searching Soulseek..." : searched ? `${results.length} results` : "Soulseek Results"}
          </h4>
          {searched && !searching && (
            <button onClick={handleSearch} className="flex items-center gap-1 text-[11px] text-[#5a5a6e] hover:text-[#8888a0] transition-colors">
              <RefreshCw className="w-3 h-3" /> Re-search
            </button>
          )}
        </div>

        {/* Results list */}
        {searching ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#34d399] animate-spin" />
            <p className="text-xs text-[#8888a0]">Searching Soulseek...</p>
            <div className="w-48 h-1 bg-[#24243a] rounded-full overflow-hidden">
              <div className="h-full bg-[#34d399] rounded-full animate-pulse w-full" />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-1.5">
              {results.map((r, i) => (
                <ResultRow
                  key={`${r.username}-${i}`}
                  result={r}
                  downloading={downloading}
                  onDownload={handleDownload}
                  formatSize={formatSize}
                  isFailed={failedUsers.has(r.username)}
                  isPreferred={isPreferred(r)}
                />
              ))}
              {searched && results.length === 0 && !error && (
                <p className="text-xs text-[#5a5a6e] text-center py-8">No results found on Soulseek</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ result, downloading, onDownload, formatSize, isFailed, isPreferred }: {
  result: SoulseekResult;
  downloading: string | null;
  onDownload: (r: SoulseekResult) => void;
  formatSize: (b: number) => string;
  isFailed?: boolean;
  isPreferred?: boolean;
}) {
  const isDownloading = downloading === result.file;
  const filename = result.file.split(/[\\/]/).pop() ?? result.file;
  const isFlac = result.format === "flac";

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      isFailed
        ? "border-[#e05566]/20 bg-[#e05566]/5 opacity-60"
        : "border-[rgba(255,255,255,0.06)] bg-[#1c1c28] hover:bg-[#24243a]"
    }`}>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-[#e0e0e8] truncate" title={filename}>{filename}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
            isFlac ? "bg-[#34d399] text-[#12121c]" : "bg-[#24243a] text-[#8888a0]"
          }`}>
            {result.format.toUpperCase()}
          </span>
          {result.bitrate && (
            <span className="text-[10px] text-[#5a5a6e]">
              {result.bitrate > 1000 ? `${Math.round(result.bitrate / 1000)} kbps` : `${result.bitrate} kbps`}
            </span>
          )}
          <span className="text-[10px] text-[#5a5a6e]">{formatSize(result.size)}</span>
          <span className={`text-[10px] ${isFailed ? "text-[#e05566]" : "text-[#5a5a6e]"}`}>{result.username}</span>
          {isPreferred && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#34d399]/20 text-[#34d399] font-semibold uppercase">
              Preferred
            </span>
          )}
          {isFailed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#e05566]/20 text-[#e05566] font-semibold uppercase">
              Failed
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDownload(result)}
        disabled={downloading !== null}
        className={`shrink-0 px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
          isFailed
            ? "bg-[#24243a] text-[#5a5a6e] hover:bg-[#f59e0b] hover:text-[#12121c]"
            : "bg-[#24243a] text-[#e0e0e8] hover:bg-[#34d399] hover:text-[#12121c] disabled:opacity-50"
        }`}
      >
        {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : isFailed ? "Retry" : "Download"}
      </button>
    </div>
  );
}

function LikeSection({ tracks, loading }: {
  tracks: LocalTrack[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");

  const filteredTracks = tracks.filter((t) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q) || t.album?.toLowerCase().includes(q);
  });

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const ids = filteredTracks.filter((t) => t.uri && !liked.has(t.id)).map((t) => t.id);
    setSelected(new Set(ids));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleLikeSelected() {
    setLiking(true);
    try {
      const uris = tracks.filter((t) => selected.has(t.id) && t.uri).map((t) => t.uri!);
      if (uris.length > 0) {
        await fetch("/api/spotify/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uris }),
        });
        setLiked((prev) => new Set([...prev, ...selected]));
        setSelected(new Set());
      }
    } catch {} finally { setLiking(false); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Bulk action bar */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap">
        <button onClick={selectAll} className="text-xs text-[#8888a0] hover:text-[#e0e0e8] transition-colors">
          Select all
        </button>
        <button onClick={deselectAll} className="text-xs text-[#8888a0] hover:text-[#e0e0e8] transition-colors">
          Deselect all
        </button>
        <div className="flex-1" />
        {selected.size > 0 && (
          <button
            onClick={handleLikeSelected}
            disabled={liking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#34d399] text-[#12121c] text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {liking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            Like {selected.size} on Spotify
          </button>
        )}
      </div>

      {/* Search */}
      <div className="shrink-0 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e]" />
        <input
          type="text"
          placeholder="Search tracks..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-md bg-[#141420] border border-[rgba(255,255,255,0.06)] text-sm text-[#e0e0e8] placeholder-[#5a5a6e] outline-none focus:border-[#34d399]/40 transition-colors"
        />
      </div>

      {/* Track list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[#34d399] animate-spin" />
        </div>
      ) : filteredTracks.length === 0 ? (
        <p className="text-[#5a5a6e] py-8 text-center text-sm">
          {tracks.length === 0 ? "All local tracks are liked on Spotify!" : "No matches for filter"}
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-1.5">
            {filteredTracks.map((track) => {
              const isLiked = liked.has(track.id);
              return (
                <div
                  key={`like-${track.id}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                    isLiked
                      ? "border-[#34d399]/20 bg-[#34d399]/5 opacity-60"
                      : "border-[rgba(255,255,255,0.06)] bg-[#1c1c28] hover:bg-[#24243a]"
                  }`}
                >
                  {!isLiked && (
                    <input
                      type="checkbox"
                      checked={selected.has(track.id)}
                      onChange={() => toggleSelect(track.id)}
                      disabled={!track.uri}
                      className="w-4 h-4 rounded accent-[#34d399] shrink-0"
                    />
                  )}
                  {isLiked && <Check className="w-4 h-4 text-[#34d399] shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#e0e0e8] truncate">{track.title ?? "Unknown"}</p>
                    <p className="text-xs text-[#8888a0] truncate">{track.artist ?? "Unknown"} -- {track.album ?? ""}</p>
                  </div>
                  {!track.uri && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-semibold uppercase shrink-0">
                      Not on Spotify
                    </span>
                  )}
                  {isLiked && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#34d399]/20 text-[#34d399] font-semibold uppercase shrink-0">
                      Liked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
