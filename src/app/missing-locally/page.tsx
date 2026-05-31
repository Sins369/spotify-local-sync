"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchPanel } from "@/components/soulseek/search-panel";
import type { SpotifyTrack } from "@/types";

export default function MissingLocallyPage() {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchingTrackId, setSearchingTrackId] = useState<number | null>(null);

  useEffect(() => {
    fetchTracks();
  }, []);

  async function fetchTracks() {
    try {
      const res = await fetch("/api/match/results?filter=missing_locally");
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === tracks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tracks.map((t) => t.id)));
    }
  }

  const allSelected = tracks.length > 0 && selected.size === tracks.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Missing Locally</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Missing Locally</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Spotify tracks with no local match ({tracks.length} tracks)
        </p>
      </div>

      {tracks.length === 0 ? (
        <p className="text-muted-foreground">
          No missing tracks found. Run a scan and sync first.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracks.map((track) => (
              <React.Fragment key={track.id}>
                <TableRow>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(track.id)}
                      onCheckedChange={() => toggleOne(track.id)}
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
                      <div className="w-8 h-8 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {track.title ?? "Unknown"}
                  </TableCell>
                  <TableCell>{track.artist ?? "Unknown"}</TableCell>
                  <TableCell>{track.album ?? "Unknown"}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setSearchingTrackId(
                          searchingTrackId === track.id ? null : track.id
                        )
                      }
                    >
                      Search Soulseek
                    </Button>
                  </TableCell>
                </TableRow>
                {searchingTrackId === track.id && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <SearchPanel
                        trackTitle={track.title ?? ""}
                        trackArtist={track.artist ?? ""}
                        spotifyTrackId={track.id}
                        onClose={() => setSearchingTrackId(null)}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
