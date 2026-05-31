"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import type { SoulseekResult } from "@/types";

interface SpotifyTrack {
  id: number;
  spotify_id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_art_url: string | null;
}

interface LocalTrack {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  path: string;
  uri?: string;
}

export default function SyncPage() {
  const [missingLocally, setMissingLocally] = useState<SpotifyTrack[]>([]);
  const [missingOnSpotify, setMissingOnSpotify] = useState<LocalTrack[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingSpotify, setLoadingSpotify] = useState(true);
  const [hasMatches, setHasMatches] = useState<boolean | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [spotifySearchFilter, setSpotifySearchFilter] = useState("");
  const [tab, setTab] = useState<"download" | "like">("download");
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());

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

  useEffect(() => {
    fetchMissingLocally();
    fetchMissingOnSpotify();
    checkMatches();
    fetch("/api/soulseek/connect", { method: "POST" }).catch(() => {});
  }, [fetchMissingLocally, fetchMissingOnSpotify, checkMatches]);

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
  }

  const filteredLocal = missingLocally.filter((t) => {
    if (downloadedIds.has(t.id)) return false;
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q) || t.album?.toLowerCase().includes(q);
  });

  const filteredSpotify = missingOnSpotify.filter((t) => {
    if (!spotifySearchFilter) return true;
    const q = spotifySearchFilter.toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q) || t.album?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Sync</h2>
        <p className="text-sm text-[#94A3B8] mt-1">Download missing tracks and like local songs on Spotify</p>
      </div>

      {hasMatches === false && (
        <Card className="bg-[#0F172A] border-[#F59E0B]/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              <p className="text-sm text-[#F8FAFC]">Run matching first to find gaps between your libraries</p>
            </div>
            <Button onClick={handleRunMatching} disabled={matchLoading} className="bg-[#22C55E] text-[#020617] hover:bg-[#16A34A]">
              {matchLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitCompareArrows className="w-4 h-4 mr-2" />}
              {matchLoading ? "Running..." : "Run Matching"}
            </Button>
          </CardContent>
        </Card>
      )}

      {matchResult && <p className="text-sm text-[#22C55E]">{matchResult}</p>}

      {/* Tab buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab("download"); setSelectedTrack(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "download"
              ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30"
              : "bg-[#0F172A] text-[#94A3B8] border border-[#334155] hover:border-[#475569]"
          }`}
        >
          <Download className="w-4 h-4" />
          Download to Local
          <Badge className="bg-[#1E293B] text-[#94A3B8] text-[10px]">{missingLocally.length - downloadedIds.size}</Badge>
        </button>
        <button
          onClick={() => { setTab("like"); setSelectedTrack(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "like"
              ? "bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30"
              : "bg-[#0F172A] text-[#94A3B8] border border-[#334155] hover:border-[#475569]"
          }`}
        >
          <Heart className="w-4 h-4" />
          Like on Spotify
          <Badge className="bg-[#1E293B] text-[#94A3B8] text-[10px]">{missingOnSpotify.length}</Badge>
        </button>
        {downloadedIds.size > 0 && (
          <Link href="/downloads" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0F172A] text-[#22C55E] border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-all">
            <Check className="w-4 h-4" />
            {downloadedIds.size} Downloaded
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Download to Local — master-detail layout */}
      {tab === "download" && (
        <div className="flex gap-4 min-h-[600px]">
          {/* Track list (left) */}
          <div className="w-80 shrink-0 flex flex-col">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <Input
                placeholder="Filter tracks..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 bg-[#0F172A] border-[#334155] text-[#F8FAFC] h-9 text-sm"
              />
            </div>
            <p className="text-[10px] text-[#64748B] mb-2">{filteredLocal.length} tracks</p>
            <ScrollArea className="flex-1 border border-[#334155] rounded-lg bg-[#0F172A]">
              <div className="p-1">
                {loadingLocal ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin" />
                  </div>
                ) : filteredLocal.length === 0 ? (
                  <p className="text-xs text-[#64748B] py-8 text-center">
                    {missingLocally.length === 0 ? "All synced!" : "No matches for filter"}
                  </p>
                ) : (
                  filteredLocal.slice(0, 100).map((track) => (
                    <button
                      key={track.id}
                      onClick={() => setSelectedTrack(track)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                        selectedTrack?.id === track.id
                          ? "bg-[#22C55E]/10 border border-[#22C55E]/20"
                          : "hover:bg-[#1E293B] border border-transparent"
                      }`}
                    >
                      {track.album_art_url ? (
                        <img src={track.album_art_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-[#1E293B] flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-[#475569]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F8FAFC] truncate">{track.title ?? "Unknown"}</p>
                        <p className="text-[11px] text-[#94A3B8] truncate">{track.artist ?? "Unknown"}</p>
                      </div>
                    </button>
                  ))
                )}
                {filteredLocal.length > 100 && (
                  <p className="text-[10px] text-[#64748B] text-center py-2">Use filter to narrow down</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Detail panel (right) */}
          <div className="flex-1">
            {selectedTrack ? (
              <DetailPanel
                track={selectedTrack}
                onDownloaded={() => handleDownloaded(selectedTrack.id)}
                onClose={() => setSelectedTrack(null)}
              />
            ) : (
              <Card className="bg-[#0F172A] border-[#334155] h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Music className="w-12 h-12 text-[#1E293B] mx-auto mb-3" />
                  <p className="text-[#64748B]">Select a track to search and download</p>
                  <p className="text-xs text-[#475569] mt-1">Click any track on the left to get started</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Like on Spotify */}
      {tab === "like" && (
        <LikeSection
          tracks={filteredSpotify}
          allTracks={missingOnSpotify}
          loading={loadingSpotify}
          searchFilter={spotifySearchFilter}
          onSearchChange={setSpotifySearchFilter}
        />
      )}
    </div>
  );
}

function DetailPanel({ track, onDownloaded, onClose }: {
  track: SpotifyTrack;
  onDownloaded: () => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<SoulseekResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTrackId = useRef<number | null>(null);

  useEffect(() => {
    if (track.id !== prevTrackId.current) {
      prevTrackId.current = track.id;
      setResults([]);
      setSearched(false);
      setDownloaded(false);
      setError(null);
      setDownloading(null);
      handleSearch();
    }
  }, [track.id]);

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
        const allResults: SoulseekResult[] = Array.isArray(data) ? data : data.results ?? [];
        setResults(allResults.slice(0, 30));
      } else {
        const data = await res.json();
        setError(data.error || "Search failed");
      }
      setSearched(true);
    } catch {
      setError("Search failed — is Soulseek connected?");
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
        }),
      });
      if (res.ok) {
        setDownloaded(true);
        onDownloaded();
      } else {
        const data = await res.json();
        setError(data.error || "Download failed — try another user");
      }
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(null);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const flacResults = results.filter((r) => r.format === "flac");
  const mp3Results = results.filter((r) => r.format !== "flac");

  return (
    <Card className="bg-[#0F172A] border-[#334155] h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col py-4 space-y-4">
        {/* Track header */}
        <div className="flex items-start gap-4">
          {track.album_art_url ? (
            <img src={track.album_art_url} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-[#1E293B] flex items-center justify-center shrink-0">
              <Music className="w-8 h-8 text-[#475569]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-[#F8FAFC] truncate">{track.title}</h3>
            <p className="text-sm text-[#94A3B8]">{track.artist}</p>
            <p className="text-xs text-[#64748B]">{track.album}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Spotify preview */}
        {track.spotify_id && (
          <iframe
            src={`https://open.spotify.com/embed/track/${track.spotify_id}?utm_source=generator&theme=0`}
            width="100%"
            height="80"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-lg shrink-0"
          />
        )}

        {/* Downloaded state */}
        {downloaded && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
            <Check className="w-5 h-5 text-[#22C55E]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#22C55E]">Downloaded successfully</p>
            </div>
            <Link href="/downloads" className="text-xs text-[#22C55E] hover:underline flex items-center gap-1">
              View <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-400 flex-1">{error}</p>
            <Button variant="ghost" size="sm" className="text-xs text-red-400 h-6 px-2" onClick={handleSearch}>
              Retry
            </Button>
          </div>
        )}

        {/* Search results */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            {searching ? "Searching Soulseek..." : searched ? `${results.length} results` : "Soulseek Results"}
          </h4>
          {searched && !searching && (
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-[#64748B]" onClick={handleSearch}>
              Re-search
            </Button>
          )}
        </div>

        {searching ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#22C55E] animate-spin" />
            <p className="text-xs text-[#94A3B8]">Searching Soulseek network...</p>
            <div className="w-48 h-1 bg-[#1E293B] rounded-full overflow-hidden">
              <div className="h-full bg-[#22C55E] rounded-full animate-pulse w-full" />
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-2">
              {flacResults.length > 0 && (
                <>
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1 mt-2">FLAC (Lossless)</p>
                  {flacResults.map((r, i) => (
                    <ResultRow key={`flac-${i}`} result={r} downloading={downloading} onDownload={handleDownload} formatSize={formatSize} />
                  ))}
                </>
              )}
              {mp3Results.length > 0 && (
                <>
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1 mt-3">MP3 / Other</p>
                  {mp3Results.map((r, i) => (
                    <ResultRow key={`mp3-${i}`} result={r} downloading={downloading} onDownload={handleDownload} formatSize={formatSize} />
                  ))}
                </>
              )}
              {searched && results.length === 0 && !error && (
                <p className="text-xs text-[#64748B] text-center py-4">No results found on Soulseek</p>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ResultRow({ result, downloading, onDownload, formatSize }: {
  result: SoulseekResult;
  downloading: string | null;
  onDownload: (r: SoulseekResult) => void;
  formatSize: (b: number) => string;
}) {
  const isDownloading = downloading === result.file;
  const filename = result.file.split(/[\\/]/).pop() ?? result.file;

  return (
    <div className="flex items-center gap-2 p-2 rounded border border-[#1E293B] bg-[#020617] hover:border-[#334155] transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[#94A3B8] truncate" title={filename}>{filename}</p>
        <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-0.5">
          <Badge variant="secondary" className="text-[9px] px-1 py-0">{result.format.toUpperCase()}</Badge>
          {result.bitrate && <span>{result.bitrate > 1000 ? `${Math.round(result.bitrate / 1000)} kbps` : `${result.bitrate} kbps`}</span>}
          <span>{formatSize(result.size)}</span>
          <span className="text-[#475569]">{result.username}</span>
        </div>
      </div>
      <Button
        size="sm"
        className="text-[10px] h-7 px-3 shrink-0"
        onClick={() => onDownload(result)}
        disabled={downloading !== null}
      >
        {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Download"}
      </Button>
    </div>
  );
}

interface SpotifyTrack {
  id: number;
  spotify_id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_art_url: string | null;
}

function LikeSection({
  tracks, allTracks, loading, searchFilter, onSearchChange,
}: {
  tracks: LocalTrack[]; allTracks: LocalTrack[]; loading: boolean;
  searchFilter: string; onSearchChange: (v: string) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());

  function toggleSelect(id: number) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function handleLikeSelected() {
    setLiking(true);
    try {
      const uris = tracks.filter((t) => selected.has(t.id) && t.uri).map((t) => t.uri!);
      if (uris.length > 0) {
        await fetch("/api/spotify/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uris }) });
        setLiked((prev) => new Set([...prev, ...selected]));
        setSelected(new Set());
      }
    } catch {} finally { setLiking(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <Input placeholder="Search..." value={searchFilter} onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-[#0F172A] border-[#334155] text-[#F8FAFC]" />
        </div>
        {selected.size > 0 && (
          <Button onClick={handleLikeSelected} disabled={liking} className="bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] gap-2 shrink-0">
            {liking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            Like {selected.size} on Spotify
          </Button>
        )}
      </div>
      <p className="text-xs text-[#64748B]">{tracks.length} of {allTracks.length} tracks</p>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-[#A855F7] animate-spin mr-2" /><span className="text-[#94A3B8]">Loading...</span></div>
      ) : tracks.length === 0 ? (
        <p className="text-[#64748B] py-8 text-center">{allTracks.length === 0 ? "All local tracks are liked!" : "No matches"}</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {tracks.slice(0, 50).map((track) => {
            const isLiked = liked.has(track.id);
            return (
              <Card key={track.id} className={`bg-[#0F172A] border-[#334155] ${isLiked ? "border-[#22C55E]/30 opacity-60" : ""}`}>
                <CardContent className="flex items-center gap-3 py-3">
                  {!isLiked && <input type="checkbox" checked={selected.has(track.id)} onChange={() => toggleSelect(track.id)} className="w-4 h-4 rounded accent-[#22C55E]" disabled={!track.uri} />}
                  {isLiked && <Check className="w-4 h-4 text-[#22C55E] shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F8FAFC] truncate">{track.title ?? "Unknown"}</p>
                    <p className="text-xs text-[#94A3B8] truncate">{track.artist ?? "Unknown"} — {track.album ?? ""}</p>
                  </div>
                  {!track.uri && <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] shrink-0">Not on Spotify</Badge>}
                  {isLiked && <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px] shrink-0">Liked</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {tracks.length > 50 && <p className="text-xs text-[#64748B] text-center">Showing 50 of {tracks.length} — use search to filter</p>}
    </div>
  );
}
