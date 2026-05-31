"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchPanel } from "@/components/soulseek/search-panel";
import type { SpotifyTrack, LocalTrack } from "@/types";
import {
  RefreshCw,
  GitCompareArrows,
  Download,
  Heart,
  Music,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface MissingOnSpotifyTrack extends LocalTrack {
  spotify_available?: boolean;
}

export default function SyncPage() {
  const [missingLocally, setMissingLocally] = useState<SpotifyTrack[]>([]);
  const [missingOnSpotify, setMissingOnSpotify] = useState<MissingOnSpotifyTrack[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingSpotify, setLoadingSpotify] = useState(true);
  const [selectedLocal, setSelectedLocal] = useState<Set<number>>(new Set());
  const [selectedSpotify, setSelectedSpotify] = useState<Set<number>>(new Set());
  const [searchingTrackId, setSearchingTrackId] = useState<number | null>(null);
  const [liking, setLiking] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    total: number;
    matched: number;
    no_match: number;
  } | null>(null);
  const [hasMatches, setHasMatches] = useState<boolean | null>(null);

  const fetchMissingLocally = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch("/api/match/results?filter=missing_locally");
      if (res.ok) {
        const data = await res.json();
        setMissingLocally(Array.isArray(data) ? data : data.tracks ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  const fetchMissingOnSpotify = useCallback(async () => {
    setLoadingSpotify(true);
    try {
      const res = await fetch("/api/match/results?filter=missing_on_spotify");
      if (res.ok) {
        const data = await res.json();
        setMissingOnSpotify(Array.isArray(data) ? data : data.tracks ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
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
    } catch {
      // Check failed
    }
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
        setMatchResult(data);
        await Promise.all([fetchMissingLocally(), fetchMissingOnSpotify(), checkMatches()]);
      }
    } catch {
      // Matching failed
    } finally {
      setMatchLoading(false);
    }
  }

  function toggleLocalOne(id: number) {
    setSelectedLocal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLocalAll() {
    if (selectedLocal.size === missingLocally.length) {
      setSelectedLocal(new Set());
    } else {
      setSelectedLocal(new Set(missingLocally.map((t) => t.id)));
    }
  }

  function toggleSpotifyOne(id: number) {
    setSelectedSpotify((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSpotifyAll() {
    if (selectedSpotify.size === missingOnSpotify.length) {
      setSelectedSpotify(new Set());
    } else {
      setSelectedSpotify(new Set(missingOnSpotify.map((t) => t.id)));
    }
  }

  async function handleLikeSelected() {
    setLiking(true);
    try {
      const ids = Array.from(selectedSpotify);
      await fetch("/api/spotify/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_ids: ids }),
      });
      await fetchMissingOnSpotify();
      setSelectedSpotify(new Set());
    } catch {
      // Like failed
    } finally {
      setLiking(false);
    }
  }

  const allLocalSelected = missingLocally.length > 0 && selectedLocal.size === missingLocally.length;
  const allSpotifySelected = missingOnSpotify.length > 0 && selectedSpotify.size === missingOnSpotify.length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#22C55E]" />
          <div>
            <h2 className="text-2xl font-bold text-[#F8FAFC]">Sync</h2>
            <p className="text-sm text-[#94A3B8]">
              Find gaps between your local and Spotify libraries
            </p>
          </div>
        </div>
      </div>

      {/* Run Matching Banner */}
      {hasMatches === false && (
        <Card className="bg-[#0F172A] border-[#F59E0B]/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              <div>
                <p className="text-sm font-medium text-[#F8FAFC]">
                  Matching engine has not been run yet
                </p>
                <p className="text-xs text-[#94A3B8]">
                  Run matching to compare your local library with Spotify liked songs
                </p>
              </div>
            </div>
            <Button
              onClick={handleRunMatching}
              disabled={matchLoading}
              className="bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] font-semibold"
            >
              {matchLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <GitCompareArrows className="w-4 h-4 mr-2" />
                  Run Matching
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Run Matching Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={handleRunMatching}
          disabled={matchLoading}
          className="border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#22C55E]/40"
        >
          {matchLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running Matching...
            </>
          ) : (
            <>
              <GitCompareArrows className="w-4 h-4 mr-2" />
              Run Matching
            </>
          )}
        </Button>
        {matchResult && (
          <span className="text-sm text-[#94A3B8]">
            Matched {matchResult.matched} of {matchResult.total} tracks
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="missing_locally">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="missing_locally">
            <Download className="w-4 h-4 mr-1.5" />
            Missing Locally
            {!loadingLocal && (
              <Badge variant="secondary" className="ml-2 text-xs bg-[#1E293B] text-[#94A3B8]">
                {missingLocally.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="missing_on_spotify">
            <Heart className="w-4 h-4 mr-1.5" />
            Missing on Spotify
            {!loadingSpotify && (
              <Badge variant="secondary" className="ml-2 text-xs bg-[#1E293B] text-[#94A3B8]">
                {missingOnSpotify.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Missing Locally Tab */}
        <TabsContent value="missing_locally">
          <Card className="bg-[#0F172A] border-[#334155]">
            <CardHeader>
              <CardTitle className="text-[#F8FAFC] text-base">Missing Locally</CardTitle>
              <CardDescription className="text-[#94A3B8]">
                Spotify tracks with no local match ({missingLocally.length} tracks)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLocal ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin mr-2" />
                  <span className="text-[#94A3B8]">Loading...</span>
                </div>
              ) : missingLocally.length === 0 ? (
                <p className="text-[#64748B] py-8 text-center">
                  No missing tracks found. Run a scan and sync first.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#1E293B] hover:bg-transparent">
                        <TableHead className="w-10">
                          <Checkbox checked={allLocalSelected} onCheckedChange={toggleLocalAll} />
                        </TableHead>
                        <TableHead className="w-10 text-[#94A3B8]" />
                        <TableHead className="text-[#94A3B8]">Title</TableHead>
                        <TableHead className="text-[#94A3B8]">Artist</TableHead>
                        <TableHead className="text-[#94A3B8]">Album</TableHead>
                        <TableHead className="text-[#94A3B8]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingLocally.map((track) => (
                        <React.Fragment key={track.id}>
                          <TableRow className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/50 transition-colors duration-150">
                            <TableCell>
                              <Checkbox
                                checked={selectedLocal.has(track.id)}
                                onCheckedChange={() => toggleLocalOne(track.id)}
                              />
                            </TableCell>
                            <TableCell>
                              {track.album_art_url ? (
                                <img
                                  src={track.album_art_url}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-[#1E293B] flex items-center justify-center">
                                  <Music className="w-4 h-4 text-[#475569]" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-[#F8FAFC]">
                              {track.title ?? "Unknown"}
                            </TableCell>
                            <TableCell className="text-[#CBD5E1]">
                              {track.artist ?? "Unknown"}
                            </TableCell>
                            <TableCell className="text-[#CBD5E1]">
                              {track.album ?? "Unknown"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  setSearchingTrackId(
                                    searchingTrackId === track.id ? null : track.id
                                  )
                                }
                                className="border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]"
                              >
                                Search Soulseek
                              </Button>
                            </TableCell>
                          </TableRow>
                          {searchingTrackId === track.id && (
                            <TableRow>
                              <TableCell colSpan={6} className="p-0">
                                <div className="p-4 bg-[#1E293B]/30">
                                  <SearchPanel
                                    trackTitle={track.title ?? ""}
                                    trackArtist={track.artist ?? ""}
                                    spotifyTrackId={track.id}
                                    onClose={() => setSearchingTrackId(null)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Missing on Spotify Tab */}
        <TabsContent value="missing_on_spotify">
          <Card className="bg-[#0F172A] border-[#334155]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[#F8FAFC] text-base">Missing on Spotify</CardTitle>
                  <CardDescription className="text-[#94A3B8]">
                    Local tracks not in your Spotify likes ({missingOnSpotify.length} tracks)
                  </CardDescription>
                </div>
                <Button
                  onClick={handleLikeSelected}
                  disabled={selectedSpotify.size === 0 || liking}
                  className="bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] font-semibold"
                >
                  {liking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Liking...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4 mr-2" />
                      Like Selected ({selectedSpotify.size})
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSpotify ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin mr-2" />
                  <span className="text-[#94A3B8]">Loading...</span>
                </div>
              ) : missingOnSpotify.length === 0 ? (
                <p className="text-[#64748B] py-8 text-center">
                  All local tracks are in your Spotify likes. Run a scan first if this seems wrong.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#1E293B] hover:bg-transparent">
                        <TableHead className="w-10">
                          <Checkbox checked={allSpotifySelected} onCheckedChange={toggleSpotifyAll} />
                        </TableHead>
                        <TableHead className="text-[#94A3B8]">Title</TableHead>
                        <TableHead className="text-[#94A3B8]">Artist</TableHead>
                        <TableHead className="text-[#94A3B8]">Album</TableHead>
                        <TableHead className="text-[#94A3B8]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingOnSpotify.map((track) => (
                        <TableRow
                          key={track.id}
                          className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/50 transition-colors duration-150"
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedSpotify.has(track.id)}
                              onCheckedChange={() => toggleSpotifyOne(track.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-[#F8FAFC]">
                            {track.title ?? "Unknown"}
                          </TableCell>
                          <TableCell className="text-[#CBD5E1]">
                            {track.artist ?? "Unknown"}
                          </TableCell>
                          <TableCell className="text-[#CBD5E1]">
                            {track.album ?? "Unknown"}
                          </TableCell>
                          <TableCell>
                            {track.spotify_available === false && (
                              <Badge variant="destructive">Not on Spotify</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
