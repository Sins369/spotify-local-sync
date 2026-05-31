"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocalTrack } from "@/types";

interface MissingOnSpotifyTrack extends LocalTrack {
  spotify_available: boolean;
}

export default function MissingOnSpotifyPage() {
  const [tracks, setTracks] = useState<MissingOnSpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    fetchTracks();
  }, []);

  async function fetchTracks() {
    try {
      const res = await fetch("/api/match/results?filter=missing_on_spotify");
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

  async function handleLikeSelected() {
    setLiking(true);
    try {
      const ids = Array.from(selected);
      await fetch("/api/spotify/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_ids: ids }),
      });
      await fetchTracks();
      setSelected(new Set());
    } catch {
      // Like failed
    } finally {
      setLiking(false);
    }
  }

  const allSelected = tracks.length > 0 && selected.size === tracks.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Missing on Spotify</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Missing on Spotify</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Local tracks not in your Spotify likes ({tracks.length} tracks)
          </p>
        </div>
        <Button
          onClick={handleLikeSelected}
          disabled={selected.size === 0 || liking}
        >
          {liking ? "Liking..." : `Like Selected (${selected.size})`}
        </Button>
      </div>

      {tracks.length === 0 ? (
        <p className="text-muted-foreground">
          All local tracks are in your Spotify likes. Run a scan first if this
          seems wrong.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracks.map((track) => (
              <TableRow key={track.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(track.id)}
                    onCheckedChange={() => toggleOne(track.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {track.title ?? "Unknown"}
                </TableCell>
                <TableCell>{track.artist ?? "Unknown"}</TableCell>
                <TableCell>{track.album ?? "Unknown"}</TableCell>
                <TableCell>
                  {!track.spotify_available && (
                    <Badge variant="destructive">Not on Spotify</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
