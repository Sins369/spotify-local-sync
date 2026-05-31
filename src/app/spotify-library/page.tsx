"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import {
  Cloud,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Music,
} from "lucide-react";

interface SpotifyTrackRow {
  id: number;
  spotify_id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration_ms: number | null;
  added_at: string | null;
}

type SortField = "title" | "artist" | "album" | "added_at";

export default function SpotifyLibraryPage() {
  const [tracks, setTracks] = useState<SpotifyTrackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        search: debouncedSearch,
        sortBy,
        sortDir,
      });
      const res = await fetch(`/api/spotify-tracks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-[#475569]" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-[#22C55E]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#22C55E]" />
    );
  }

  const startItem = (page - 1) * 50 + 1;
  const endItem = Math.min(page * 50, total);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cloud className="w-6 h-6 text-[#22C55E]" />
          <div>
            <h2 className="text-2xl font-bold text-[#F8FAFC]">Spotify Library</h2>
            <p className="text-sm text-[#94A3B8]">
              {total.toLocaleString()} liked songs synced
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, artist, or album..."
          className="pl-10 bg-[#0F172A] border-[#334155] text-[#F8FAFC] placeholder:text-[#475569] focus:border-[#22C55E]/50"
        />
      </div>

      {/* Table Card */}
      <Card className="bg-[#0F172A] border-[#334155]">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#F8FAFC] text-base">
              {debouncedSearch
                ? `Showing ${total.toLocaleString()} results for "${debouncedSearch}"`
                : "All Spotify Liked Songs"}
            </CardTitle>
            {loading && <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin" />}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#1E293B] hover:bg-transparent">
                  <TableHead className="w-10 text-[#94A3B8]" />
                  {([
                    ["title", "Title"],
                    ["artist", "Artist"],
                    ["album", "Album"],
                    ["added_at", "Date Added"],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <TableHead
                      key={field}
                      className="cursor-pointer select-none text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
                      onClick={() => handleSort(field)}
                    >
                      <span className="flex items-center gap-1.5">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-[#94A3B8]">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[#64748B] py-8">
                      {debouncedSearch
                        ? "No tracks match your search."
                        : "No Spotify tracks found. Sync your library first."}
                    </TableCell>
                  </TableRow>
                ) : (
                  tracks.map((track) => (
                    <TableRow
                      key={track.id}
                      className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/50 transition-colors duration-150"
                    >
                      <TableCell>
                        <div className="w-8 h-8 rounded bg-[#1E293B] flex items-center justify-center">
                          <Music className="w-4 h-4 text-[#475569]" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-[#F8FAFC] max-w-[250px] truncate">
                        {track.title ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-[#CBD5E1] max-w-[200px] truncate">
                        {track.artist ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-[#CBD5E1] max-w-[200px] truncate">
                        {track.album ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-[#94A3B8] tabular-nums text-xs">
                        {formatDate(track.added_at)}
                      </TableCell>
                      <TableCell className="text-[#94A3B8] tabular-nums">
                        {formatDuration(track.duration_ms)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#1E293B] mt-4">
              <p className="text-xs text-[#64748B]">
                Showing {startItem}-{endItem} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-[#94A3B8] tabular-nums min-w-[80px] text-center">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
