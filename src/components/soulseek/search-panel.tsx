"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SoulseekResult } from "@/types";

interface SearchPanelProps {
  trackTitle: string;
  trackArtist: string;
  spotifyTrackId: number;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SearchPanel({
  trackTitle,
  trackArtist,
  spotifyTrackId,
  onClose,
}: SearchPanelProps) {
  const [results, setResults] = useState<SoulseekResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/soulseek/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${trackArtist} ${trackTitle}` }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
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
          spotify_track_id: spotifyTrackId,
          username: result.username,
          file: result.file,
        }),
      });
      if (!res.ok) throw new Error("Download failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="border rounded-lg bg-card p-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Soulseek Search: {trackArtist} - {trackTitle}
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {!searched && (
        <Button onClick={handleSearch} disabled={searching} size="sm">
          {searching ? "Searching..." : "Search"}
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No results found.</p>
      )}

      {results.length > 0 && (
        <ScrollArea className="max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Bitrate</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>User</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={`${r.username}:${r.file}`}>
                  <TableCell className="max-w-[200px] truncate" title={r.file}>
                    {r.file.split(/[\\/]/).pop()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.format}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.bitrate ? `${r.bitrate} kbps` : "N/A"}
                  </TableCell>
                  <TableCell>{formatSize(r.size)}</TableCell>
                  <TableCell className="max-w-[100px] truncate">
                    {r.username}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="xs"
                      onClick={() => handleDownload(r)}
                      disabled={downloading === r.file}
                    >
                      {downloading === r.file ? "..." : "Download"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}
