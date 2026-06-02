"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Columns3,
  Loader2,
} from "lucide-react";

interface LibraryTrack {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  format: string | null;
  bitrate: number | null;
  duration_ms: number | null;
  year: number | null;
  file_path: string | null;
  spotify_added_at: string | null;
  matched: number;
}

interface LibraryResponse {
  tracks: LibraryTrack[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type SortField =
  | "title"
  | "artist"
  | "album"
  | "genre"
  | "format"
  | "bitrate"
  | "duration"
  | "year"
  | "spotify_added_at"
  | "file_path"
  | "matched";

type FormatFilter = "all" | "flac" | "mp3" | "other";
type MatchFilter = "all" | "matched" | "unmatched";
type SourceFilter = "all" | "local" | "spotify" | "both";

interface ColumnDef {
  key: string;
  label: string;
  toggleable: boolean;
  defaultOn: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Title", toggleable: false, defaultOn: true },
  { key: "artist", label: "Artist", toggleable: true, defaultOn: true },
  { key: "album", label: "Album", toggleable: true, defaultOn: true },
  { key: "genre", label: "Genre", toggleable: true, defaultOn: false },
  { key: "format", label: "Format", toggleable: true, defaultOn: true },
  { key: "bitrate", label: "Bitrate", toggleable: true, defaultOn: false },
  { key: "duration", label: "Duration", toggleable: true, defaultOn: false },
  { key: "year", label: "Year", toggleable: true, defaultOn: false },
  { key: "spotify_added_at", label: "Date Added to Spotify", toggleable: true, defaultOn: false },
  { key: "file_path", label: "File Path", toggleable: true, defaultOn: false },
  { key: "matched", label: "Matched", toggleable: true, defaultOn: true },
];

export default function LibraryPage() {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    for (const col of ALL_COLUMNS) {
      if (col.defaultOn) defaults.add(col.key);
    }
    return defaults;
  });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  // Track counts for subtitle
  const [localCount, setLocalCount] = useState(0);
  const [spotifyCount, setSpotifyCount] = useState(0);

  // Close column dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch track counts for header
  useEffect(() => {
    async function fetchCounts() {
      try {
        const [localRes, spotifyRes] = await Promise.all([
          fetch("/api/library?limit=1&source=local"),
          fetch("/api/library?limit=1&source=spotify"),
        ]);
        if (localRes.ok) {
          const data = await localRes.json();
          setLocalCount(data.total ?? 0);
        }
        if (spotifyRes.ok) {
          const data = await spotifyRes.json();
          setSpotifyCount(data.total ?? 0);
        }
      } catch {
        // ignore
      }
    }
    fetchCounts();
  }, []);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        search: debouncedSearch,
        sortBy,
        sortDir,
        format: formatFilter,
        matchStatus: matchFilter,
        source: sourceFilter,
      });
      const res = await fetch(`/api/library?${params}`);
      if (res.ok) {
        const data: LibraryResponse = await res.json();
        setTracks(data.tracks ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortDir, formatFilter, matchFilter, sourceFilter]);

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

  function handleFilterChange<T>(setter: (val: T) => void, val: T) {
    setter(val);
    setPage(1);
  }

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function formatBitrate(br: number | null): string {
    if (!br) return "-";
    return `${br} kbps`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  function getCellValue(track: LibraryTrack, key: string): React.ReactNode {
    switch (key) {
      case "title":
        return <span className="text-[#e0e0e8] font-medium">{track.title ?? "Unknown"}</span>;
      case "artist":
        return <span className="text-[#8888a0]">{track.artist ?? "Unknown"}</span>;
      case "album":
        return <span className="text-[#8888a0]">{track.album ?? "Unknown"}</span>;
      case "genre":
        return <span className="text-[#8888a0]">{track.genre ?? "-"}</span>;
      case "format":
        return <span className="text-[#8888a0] uppercase">{track.format ?? "-"}</span>;
      case "bitrate":
        return <span className="text-[#8888a0] tabular-nums">{formatBitrate(track.bitrate)}</span>;
      case "duration":
        return <span className="text-[#8888a0] tabular-nums">{formatDuration(track.duration_ms)}</span>;
      case "year":
        return <span className="text-[#8888a0] tabular-nums">{track.year ?? "-"}</span>;
      case "spotify_added_at":
        return <span className="text-[#8888a0]">{formatDate(track.spotify_added_at)}</span>;
      case "file_path":
        return <span className="text-[#8888a0] truncate max-w-[200px] block">{track.file_path ?? "-"}</span>;
      case "matched":
        return (
          <span className="flex items-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                track.matched
                  ? "bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                  : "bg-[#3a3a4e]"
              }`}
            />
          </span>
        );
      default:
        return "-";
    }
  }

  function getSortField(key: string): SortField | null {
    const sortable: Record<string, SortField> = {
      title: "title", artist: "artist", album: "album", genre: "genre",
      format: "format", bitrate: "bitrate", duration: "duration", year: "year",
      spotify_added_at: "spotify_added_at", file_path: "file_path", matched: "matched",
    };
    return sortable[key] ?? null;
  }

  const startItem = total === 0 ? 0 : (page - 1) * 20 + 1;
  const endItem = Math.min(page * 20, total);

  // Generate page numbers for pagination
  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-[800] text-[#e0e0e8]">Library</h1>
        <p className="text-[14px] text-[#8888a0]">
          {localCount.toLocaleString()} local &middot; {spotifyCount.toLocaleString()} Spotify
        </p>
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        {/* Column Toggle Dropdown */}
        <div className="relative" ref={columnsRef}>
          <button
            onClick={() => setColumnsOpen(!columnsOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] text-[#8888a0] bg-[#24243a] border border-[rgba(255,255,255,0.06)] hover:text-[#e0e0e8] transition-colors"
          >
            <Columns3 className="w-3.5 h-3.5" />
            Columns
          </button>
          {columnsOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] rounded-lg shadow-xl p-2 min-w-[180px]">
              {ALL_COLUMNS.filter((col) => col.toggleable).map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#24243a] cursor-pointer text-[13px] text-[#8888a0]"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="w-3.5 h-3.5 rounded border-[#3a3a4e] bg-[#141420] accent-[#34d399]"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5a5a6e]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 w-64 rounded bg-[#141420] border border-[rgba(255,255,255,0.06)] text-[13px] text-[#e0e0e8] placeholder:text-[#5a5a6e] outline-none focus:border-[#34d399]/40 transition-colors"
          />
        </div>

        {/* Format Filter */}
        <FilterGroup
          options={[
            { value: "all", label: "All" },
            { value: "flac", label: "FLAC" },
            { value: "mp3", label: "MP3" },
            { value: "other", label: "Other" },
          ]}
          value={formatFilter}
          onChange={(v) => handleFilterChange(setFormatFilter, v as FormatFilter)}
        />

        {/* Match Status Filter */}
        <FilterGroup
          options={[
            { value: "all", label: "All" },
            { value: "matched", label: "Matched" },
            { value: "unmatched", label: "Unmatched" },
          ]}
          value={matchFilter}
          onChange={(v) => handleFilterChange(setMatchFilter, v as MatchFilter)}
        />

        {/* Source Filter */}
        <FilterGroup
          options={[
            { value: "all", label: "All" },
            { value: "local", label: "Local Only" },
            { value: "spotify", label: "Spotify Only" },
            { value: "both", label: "Both" },
          ]}
          value={sourceFilter}
          onChange={(v) => handleFilterChange(setSourceFilter, v as SourceFilter)}
        />

        {loading && <Loader2 className="w-4 h-4 text-[#34d399] animate-spin ml-auto" />}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-t-lg border border-[rgba(255,255,255,0.06)] border-b-0">
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="w-full text-left">
            <thead className="bg-[#161620] sticky top-0 z-10">
              <tr>
                {ALL_COLUMNS.filter((col) => visibleColumns.has(col.key)).map((col) => {
                  const sortField = getSortField(col.key);
                  const isSorted = sortField && sortBy === sortField;
                  return (
                    <th
                      key={col.key}
                      onClick={sortField ? () => handleSort(sortField) : undefined}
                      className={`px-3 py-2.5 text-[10px] uppercase font-bold tracking-[1.5px] text-[#5a5a6e] whitespace-nowrap ${
                        sortField ? "cursor-pointer select-none hover:text-[#8888a0]" : ""
                      } transition-colors`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortField && (
                          isSorted ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="w-3 h-3 text-[#34d399]" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-[#34d399]" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 text-[#3a3a4e]" />
                          )
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={visibleColumns.size}
                    className="text-center text-[#5a5a6e] py-12 text-[13px]"
                  >
                    {debouncedSearch
                      ? "No tracks match your search."
                      : "No tracks found. Scan your library first."}
                  </td>
                </tr>
              ) : (
                tracks.map((track) => (
                  <tr
                    key={`${track.id}-${track.file_path ?? "s"}-${track.spotify_added_at ?? "l"}`}
                    className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[#24243a] transition-colors duration-100"
                  >
                    {ALL_COLUMNS.filter((col) => visibleColumns.has(col.key)).map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-[13px] whitespace-nowrap"
                      >
                        {getCellValue(track, col.key)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between bg-[#161620] px-4 py-2 rounded-b-lg border border-[rgba(255,255,255,0.06)] border-t-[rgba(255,255,255,0.06)]">
        <span className="text-[12px] text-[#8888a0]">
          Showing {startItem}-{endItem} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-2 py-1 rounded text-[12px] text-[#8888a0] bg-[#24243a] disabled:opacity-40 hover:text-[#e0e0e8] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {getPageNumbers().map((p, i) =>
            p === "..." ? (
              <span key={`dots-${i}`} className="px-1.5 text-[12px] text-[#5a5a6e]">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                  page === p
                    ? "bg-[#34d399] text-[#12121c]"
                    : "bg-[#24243a] text-[#8888a0] hover:text-[#e0e0e8]"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded text-[12px] text-[#8888a0] bg-[#24243a] disabled:opacity-40 hover:text-[#e0e0e8] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle group component for filters
function FilterGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center rounded bg-[#24243a] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
            value === opt.value
              ? "bg-[#34d399] text-[#12121c]"
              : "text-[#8888a0] hover:text-[#e0e0e8]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
