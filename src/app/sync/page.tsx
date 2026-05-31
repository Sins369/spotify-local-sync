"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Play,
  Pause,
  Check,
} from "lucide-react";
import type { SoulseekResult } from "@/types";
import { useRef } from "react";

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

  const fetchMissingLocally = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch("/api/match/results?filter=missing_locally");
      if (res.ok) {
        const data = await res.json();
        setMissingLocally(Array.isArray(data) ? data : []);
      }
    } catch {} finally {
      setLoadingLocal(false);
    }
  }, []);

  const fetchMissingOnSpotify = useCallback(async () => {
    setLoadingSpotify(true);
    try {
      const res = await fetch("/api/match/results?filter=missing_on_spotify");
      if (res.ok) {
        const data = await res.json();
        setMissingOnSpotify(Array.isArray(data) ? data : []);
      }
    } catch {} finally {
      setLoadingSpotify(false);
    }
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
    } catch {} finally {
      setMatchLoading(false);
    }
  }

  const filteredLocal = missingLocally.filter((t) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.artist?.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q)
    );
  });

  const filteredSpotify = missingOnSpotify.filter((t) => {
    if (!spotifySearchFilter) return true;
    const q = spotifySearchFilter.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.artist?.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Sync</h2>
        <p className="text-sm text-[#94A3B8] mt-1">
          Download missing tracks and like local songs on Spotify
        </p>
      </div>

      {/* Matching banner */}
      {hasMatches === false && (
        <Card className="bg-[#0F172A] border-[#F59E0B]/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              <p className="text-sm text-[#F8FAFC]">
                Run matching first to find gaps between your libraries
              </p>
            </div>
            <Button onClick={handleRunMatching} disabled={matchLoading} className="bg-[#22C55E] text-[#020617] hover:bg-[#16A34A]">
              {matchLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitCompareArrows className="w-4 h-4 mr-2" />}
              {matchLoading ? "Running..." : "Run Matching"}
            </Button>
          </CardContent>
        </Card>
      )}

      {matchResult && (
        <p className="text-sm text-[#22C55E]">{matchResult}</p>
      )}

      {/* Tab buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("download")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "download"
              ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30"
              : "bg-[#0F172A] text-[#94A3B8] border border-[#334155] hover:border-[#475569]"
          }`}
        >
          <Download className="w-4 h-4" />
          Download to Local
          <Badge className="bg-[#1E293B] text-[#94A3B8] text-[10px]">{missingLocally.length}</Badge>
        </button>
        <button
          onClick={() => setTab("like")}
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
      </div>

      {/* Download to Local */}
      {tab === "download" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <Input
                placeholder="Search by title, artist, or album..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 bg-[#0F172A] border-[#334155] text-[#F8FAFC]"
              />
            </div>
            <p className="text-xs text-[#64748B] shrink-0">
              {filteredLocal.length} of {missingLocally.length} tracks
            </p>
          </div>

          {loadingLocal ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin mr-2" />
              <span className="text-[#94A3B8]">Loading...</span>
            </div>
          ) : filteredLocal.length === 0 ? (
            <p className="text-[#64748B] py-8 text-center">
              {missingLocally.length === 0 ? "All your Spotify likes exist locally!" : "No tracks match your search."}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredLocal.slice(0, 50).map((track) => (
                <DownloadCard key={track.id} track={track} />
              ))}
            </div>
          )}

          {filteredLocal.length > 50 && (
            <p className="text-xs text-[#64748B] text-center">
              Showing 50 of {filteredLocal.length} — use search to filter
            </p>
          )}
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
          onRefresh={fetchMissingOnSpotify}
        />
      )}
    </div>
  );
}

function DownloadCard({ track }: { track: { id: number; title: string | null; artist: string | null; album: string | null; album_art_url?: string | null } }) {
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<SoulseekResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handleSearch() {
    setExpanded(true);
    setSearching(true);
    try {
      const res = await fetch("/api/soulseek/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${track.artist} ${track.title}` }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : data.results ?? []);
      }
    } catch {} finally {
      setSearching(false);
    }
  }

  async function handleDownload(result: SoulseekResult) {
    setDownloading(result.file);
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
      if (res.ok) setDownloaded(true);
    } catch {} finally {
      setDownloading(null);
    }
  }

  function togglePreview(url: string) {
    if (previewPlaying === url) {
      audioRef.current?.pause();
      setPreviewPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.onended = () => setPreviewPlaying(null);
    audio.play();
    audioRef.current = audio;
    setPreviewPlaying(url);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (downloaded) {
    return (
      <Card className="bg-[#0F172A] border-[#22C55E]/30">
        <CardContent className="flex items-center gap-3 py-4">
          <Check className="w-5 h-5 text-[#22C55E]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F8FAFC] truncate">{track.title}</p>
            <p className="text-xs text-[#94A3B8]">{track.artist}</p>
          </div>
          <Badge className="bg-[#22C55E]/20 text-[#22C55E]">Downloaded</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0F172A] border-[#334155]">
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center gap-3">
          {track.album_art_url ? (
            <img src={track.album_art_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded bg-[#1E293B] flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-[#475569]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F8FAFC] truncate">{track.title ?? "Unknown"}</p>
            <p className="text-xs text-[#94A3B8] truncate">{track.artist ?? "Unknown"} — {track.album ?? ""}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs shrink-0 border-[#334155]"
            onClick={expanded ? () => setExpanded(false) : handleSearch}
            disabled={searching}
          >
            {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : expanded ? "Close" : "Search"}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-2">
            {searching ? (
              <div className="flex items-center gap-2 py-3 justify-center">
                <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin" />
                <span className="text-xs text-[#94A3B8]">Searching Soulseek...</span>
              </div>
            ) : results.length === 0 ? (
              <p className="text-xs text-[#64748B] py-2 text-center">No results found</p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {results.slice(0, 15).map((r, i) => (
                    <div
                      key={`${r.username}-${i}`}
                      className="flex items-center gap-2 p-2 rounded border border-[#1E293B] bg-[#020617] hover:border-[#334155] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono text-[#94A3B8] truncate">
                          {r.file.split(/[\\/]/).pop()}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{r.format.toUpperCase()}</Badge>
                          {r.bitrate && <span>{r.bitrate} kbps</span>}
                          <span>{formatSize(r.size)}</span>
                          <span className="text-[#475569]">from {r.username}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="text-[10px] h-7 px-2 shrink-0"
                        onClick={() => handleDownload(r)}
                        disabled={downloading !== null}
                      >
                        {downloading === r.file ? <Loader2 className="w-3 h-3 animate-spin" /> : "Download"}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LikeSection({
  tracks,
  allTracks,
  loading,
  searchFilter,
  onSearchChange,
  onRefresh,
}: {
  tracks: LocalTrack[];
  allTracks: LocalTrack[];
  loading: boolean;
  searchFilter: string;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleLikeSelected() {
    setLiking(true);
    try {
      const uris = tracks
        .filter((t) => selected.has(t.id) && t.uri)
        .map((t) => t.uri!);
      if (uris.length > 0) {
        await fetch("/api/spotify/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uris }),
        });
        setLiked((prev) => new Set([...prev, ...selected]));
        setSelected(new Set());
      }
    } catch {} finally {
      setLiking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <Input
            placeholder="Search by title, artist, or album..."
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-[#0F172A] border-[#334155] text-[#F8FAFC]"
          />
        </div>
        {selected.size > 0 && (
          <Button
            onClick={handleLikeSelected}
            disabled={liking}
            className="bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] gap-2 shrink-0"
          >
            {liking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            Like {selected.size} on Spotify
          </Button>
        )}
      </div>

      <p className="text-xs text-[#64748B]">
        {tracks.length} of {allTracks.length} tracks
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[#A855F7] animate-spin mr-2" />
          <span className="text-[#94A3B8]">Loading...</span>
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-[#64748B] py-8 text-center">
          {allTracks.length === 0 ? "All local tracks are liked on Spotify!" : "No tracks match your search."}
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {tracks.slice(0, 50).map((track) => {
            const isLiked = liked.has(track.id);
            return (
              <Card
                key={track.id}
                className={`bg-[#0F172A] border-[#334155] ${isLiked ? "border-[#22C55E]/30 opacity-60" : ""}`}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  {!isLiked && (
                    <input
                      type="checkbox"
                      checked={selected.has(track.id)}
                      onChange={() => toggleSelect(track.id)}
                      className="w-4 h-4 rounded border-[#334155] accent-[#22C55E]"
                      disabled={!track.uri}
                    />
                  )}
                  {isLiked && <Check className="w-4 h-4 text-[#22C55E] shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F8FAFC] truncate">{track.title ?? "Unknown"}</p>
                    <p className="text-xs text-[#94A3B8] truncate">{track.artist ?? "Unknown"} — {track.album ?? ""}</p>
                  </div>
                  {!track.uri && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] shrink-0">
                      Not on Spotify
                    </Badge>
                  )}
                  {isLiked && (
                    <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px] shrink-0">
                      Liked
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tracks.length > 50 && (
        <p className="text-xs text-[#64748B] text-center">
          Showing 50 of {tracks.length} — use search to filter
        </p>
      )}
    </div>
  );
}
