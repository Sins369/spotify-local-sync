"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, ArrowRight } from "lucide-react";
import type { MetadataDiff } from "@/types";

interface GroupedTrack {
  local_track_id: number;
  spotify_track_id: number;
  local_path: string;
  title: string;
  artist: string;
  album: string;
  diffs: MetadataDiff[];
}

function groupDiffsByTrack(diffs: MetadataDiff[]): GroupedTrack[] {
  const map = new Map<number, GroupedTrack>();

  for (const diff of diffs) {
    let group = map.get(diff.local_track_id);
    if (!group) {
      // Extract track info from the path
      const pathParts = diff.local_path.replace(/\\/g, "/").split("/");
      const filename = pathParts[pathParts.length - 1] ?? "";
      const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

      group = {
        local_track_id: diff.local_track_id,
        spotify_track_id: diff.spotify_track_id,
        local_path: diff.local_path,
        title: nameWithoutExt,
        artist: "",
        album: "",
        diffs: [],
      };
      map.set(diff.local_track_id, group);
    }

    // Use diff field values to populate card header info
    if (diff.field === "title" && diff.local_value) {
      group.title = diff.local_value;
    }
    if (diff.field === "artist" && diff.local_value) {
      group.artist = diff.local_value;
    }
    if (diff.field === "album" && diff.local_value) {
      group.album = diff.local_value;
    }

    group.diffs.push(diff);
  }

  return Array.from(map.values());
}

export default function MetadataPage() {
  const [diffs, setDiffs] = useState<MetadataDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [appliedDiffs, setAppliedDiffs] = useState<Set<string>>(new Set());
  const [appliedTracks, setAppliedTracks] = useState<Set<number>>(new Set());

  const grouped = useMemo(() => groupDiffsByTrack(diffs), [diffs]);

  const totalFieldDiffs = diffs.length;
  const totalTracks = grouped.length;

  useEffect(() => {
    fetchDiffs();
  }, []);

  async function fetchDiffs() {
    try {
      const res = await fetch("/api/metadata/diffs");
      if (res.ok) {
        const data = await res.json();
        setDiffs(data.diffs ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  function diffKey(diff: MetadataDiff): string {
    return `${diff.local_track_id}:${diff.field}`;
  }

  const toggleTrackSelection = useCallback((trackId: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }, []);

  async function applyDiffs(diffsToApply: MetadataDiff[]) {
    // Mark as applied locally for immediate visual feedback
    const keys = diffsToApply.map(diffKey);
    const trackIds = new Set(diffsToApply.map((d) => d.local_track_id));

    setAppliedDiffs((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });

    // Check if entire track is now applied
    for (const trackId of trackIds) {
      const group = grouped.find((g) => g.local_track_id === trackId);
      if (group && group.diffs.every((d) => keys.includes(diffKey(d)) || appliedDiffs.has(diffKey(d)))) {
        setAppliedTracks((prev) => new Set(prev).add(trackId));
      }
    }

    try {
      await fetch("/api/metadata/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffs: diffsToApply }),
      });
      await fetchDiffs();
      // Clear applied state after refetch
      setAppliedDiffs(new Set());
      setAppliedTracks(new Set());
      setSelectedTracks(new Set());
    } catch {
      // Revert applied state on failure
      setAppliedDiffs((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
      setAppliedTracks((prev) => {
        const next = new Set(prev);
        trackIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  function handleApplySelected() {
    const diffsToApply = grouped
      .filter((g) => selectedTracks.has(g.local_track_id))
      .flatMap((g) => g.diffs);
    if (diffsToApply.length > 0) {
      applyDiffs(diffsToApply);
    }
  }

  function handleApplyTrack(group: GroupedTrack) {
    applyDiffs(group.diffs);
  }

  function handleApplyField(diff: MetadataDiff) {
    applyDiffs([diff]);
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#e0e0e8",
            margin: 0,
          }}
        >
          Metadata
        </h1>
        <p style={{ fontSize: 14, color: "#8888a0", marginTop: 4 }}>
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "#12121c" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#e0e0e8",
              margin: 0,
            }}
          >
            Metadata
          </h1>
          <p style={{ fontSize: 14, color: "#8888a0", marginTop: 4 }}>
            {totalTracks} tracks &middot; {totalFieldDiffs} field differences
          </p>
        </div>
        <button
          onClick={handleApplySelected}
          disabled={selectedTracks.size === 0}
          style={{
            background: selectedTracks.size === 0 ? "#2a2a3a" : "#34d399",
            color: selectedTracks.size === 0 ? "#5a5a6e" : "#12121c",
            border: "none",
            borderRadius: 4,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: selectedTracks.size === 0 ? "not-allowed" : "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          Apply Selected
        </button>
      </div>

      {/* Track Cards Grid */}
      {grouped.length === 0 ? (
        <p style={{ color: "#8888a0", fontSize: 14 }}>
          No metadata differences found. All matched tracks have consistent
          metadata.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 16,
          }}
        >
          {grouped.map((group) => {
            const isTrackApplied = appliedTracks.has(group.local_track_id);
            const isSelected = selectedTracks.has(group.local_track_id);

            return (
              <div
                key={group.local_track_id}
                style={{
                  background: "#1c1c28",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 4,
                  padding: 16,
                  opacity: isTrackApplied ? 0.4 : 1,
                  transition: "opacity 0.3s",
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTrackSelection(group.local_track_id)}
                    style={{
                      marginTop: 2,
                      accentColor: "#34d399",
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />

                  {/* Track info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#e0e0e8",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {group.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8888a0",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {[group.artist, group.album].filter(Boolean).join(" • ") || group.local_path}
                    </div>
                  </div>

                  {/* Apply all button */}
                  <button
                    onClick={() => handleApplyTrack(group)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(52,211,153,0.3)",
                      borderRadius: 4,
                      color: "#34d399",
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "4px 10px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Apply all ({group.diffs.length})
                  </button>
                </div>

                {/* Field Diffs */}
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.diffs.map((diff) => {
                    const isFieldApplied = appliedDiffs.has(diffKey(diff));

                    return (
                      <div
                        key={diffKey(diff)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          opacity: isFieldApplied ? 0.4 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        {/* Field name */}
                        <span
                          style={{
                            fontSize: 12,
                            color: "#5a5a6e",
                            textTransform: "uppercase",
                            fontWeight: 500,
                            minWidth: 60,
                            flexShrink: 0,
                          }}
                        >
                          {diff.field}
                        </span>

                        {/* Local value */}
                        <span
                          style={{
                            background: "#f59e0b20",
                            color: "#f59e0b",
                            borderRadius: 2,
                            padding: "2px 6px",
                            fontSize: 12,
                            textDecoration: isFieldApplied ? "line-through" : "none",
                            maxWidth: 120,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={diff.local_value ?? "(empty)"}
                        >
                          {diff.local_value ?? "(empty)"}
                        </span>

                        {/* Arrow */}
                        <ArrowRight
                          size={12}
                          style={{ color: "#5a5a6e", flexShrink: 0 }}
                        />

                        {/* Spotify value */}
                        <span
                          style={{
                            background: "#34d39920",
                            color: "#34d399",
                            borderRadius: 2,
                            padding: "2px 6px",
                            fontSize: 12,
                            textDecoration: isFieldApplied ? "line-through" : "none",
                            maxWidth: 120,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={diff.spotify_value ?? "(empty)"}
                        >
                          {diff.spotify_value ?? "(empty)"}
                        </span>

                        {/* Applied checkmark or Apply button */}
                        {isFieldApplied ? (
                          <Check
                            size={14}
                            style={{ color: "#34d399", flexShrink: 0 }}
                          />
                        ) : (
                          <button
                            onClick={() => handleApplyField(diff)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#34d399",
                              fontSize: 11,
                              cursor: "pointer",
                              padding: "2px 4px",
                              flexShrink: 0,
                              textDecoration: "none",
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.textDecoration = "underline";
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.textDecoration = "none";
                            }}
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
