"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, ArrowRight, X, RefreshCw, Loader2 } from "lucide-react";
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

    if (diff.field === "title" && diff.local_value) group.title = diff.local_value;
    if (diff.field === "artist" && diff.local_value) group.artist = diff.local_value;
    if (diff.field === "album" && diff.local_value) group.album = diff.local_value;

    group.diffs.push(diff);
  }

  return Array.from(map.values());
}

function loadIgnored(): Set<string> {
  try {
    const stored = localStorage.getItem("metadata_ignored");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

function saveIgnored(ignored: Set<string>) {
  localStorage.setItem("metadata_ignored", JSON.stringify([...ignored]));
}

export default function MetadataPage() {
  const [diffs, setDiffs] = useState<MetadataDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [appliedDiffs, setAppliedDiffs] = useState<Set<string>>(new Set());
  const [appliedTracks, setAppliedTracks] = useState<Set<number>>(new Set());
  const [ignoredTracks, setIgnoredTracks] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);

  useEffect(() => {
    setIgnoredTracks(loadIgnored());
  }, []);

  const allGrouped = useMemo(() => groupDiffsByTrack(diffs), [diffs]);
  const grouped = useMemo(() => {
    if (showIgnored) return allGrouped;
    return allGrouped.filter((g) => !ignoredTracks.has(ignoreKey(g)));
  }, [allGrouped, ignoredTracks, showIgnored]);
  const ignoredCount = allGrouped.length - allGrouped.filter((g) => !ignoredTracks.has(ignoreKey(g))).length;

  const totalFieldDiffs = grouped.reduce((sum, g) => sum + g.diffs.length, 0);
  const totalTracks = grouped.length;

  useEffect(() => { fetchDiffs(); }, []);

  async function fetchDiffs() {
    try {
      const res = await fetch("/api/metadata/diffs");
      if (res.ok) {
        const data = await res.json();
        setDiffs(Array.isArray(data) ? data : data.diffs ?? []);
      }
    } catch {} finally { setLoading(false); }
  }

  function diffKey(diff: MetadataDiff): string {
    return `${diff.local_track_id}:${diff.field}`;
  }

  function ignoreKey(group: GroupedTrack): string {
    return `${group.local_track_id}:${group.spotify_track_id}`;
  }

  const toggleTrackSelection = useCallback((trackId: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return next;
    });
  }, []);

  function handleIgnore(group: GroupedTrack) {
    const key = ignoreKey(group);
    setIgnoredTracks((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveIgnored(next);
      return next;
    });
  }

  function handleUnignore(group: GroupedTrack) {
    const key = ignoreKey(group);
    setIgnoredTracks((prev) => {
      const next = new Set(prev);
      next.delete(key);
      saveIgnored(next);
      return next;
    });
  }

  async function applyDiffs(diffsToApply: MetadataDiff[]) {
    const keys = diffsToApply.map(diffKey);
    const trackIds = new Set(diffsToApply.map((d) => d.local_track_id));

    setAppliedDiffs((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });

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
        body: JSON.stringify({
          changes: diffsToApply.map((d) => ({
            local_path: d.local_path,
            field: d.field,
            spotify_value: d.spotify_value,
          })),
        }),
      });
      await fetchDiffs();
      setAppliedDiffs(new Set());
      setAppliedTracks(new Set());
      setSelectedTracks(new Set());
    } catch {
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
    if (diffsToApply.length > 0) applyDiffs(diffsToApply);
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-[22px] font-[800] text-[#e0e0e8]">Metadata</h1>
        <p className="text-sm text-[#8888a0] mt-1">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-[800] text-[#e0e0e8]">Metadata</h1>
          <p className="text-sm text-[#8888a0] mt-1">
            {totalTracks} tracks &middot; {totalFieldDiffs} field differences
            {ignoredCount > 0 && (
              <button
                onClick={() => setShowIgnored(!showIgnored)}
                className="ml-2 text-[#5a5a6e] hover:text-[#8888a0] transition-colors"
              >
                &middot; {ignoredCount} ignored {showIgnored ? "(hide)" : "(show)"}
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchDiffs(); }}
            disabled={loading}
            className="px-3 py-2 rounded text-sm bg-[#24243a] text-[#e0e0e8] hover:bg-[#34d399] hover:text-[#12121c] transition-colors flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          <button
            onClick={handleApplySelected}
            disabled={selectedTracks.size === 0}
            className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
              selectedTracks.size > 0
                ? "bg-[#34d399] text-[#12121c] hover:brightness-110"
                : "bg-[#24243a] text-[#5a5a6e] cursor-not-allowed"
            }`}
          >
            Apply Selected{selectedTracks.size > 0 && ` (${selectedTracks.size})`}
          </button>
        </div>
      </div>

      {/* Track Cards Grid */}
      {grouped.length === 0 ? (
        <p className="text-sm text-[#8888a0]">
          No metadata differences found. All matched tracks have consistent metadata.
        </p>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {grouped.map((group) => {
            const isTrackApplied = appliedTracks.has(group.local_track_id);
            const isSelected = selectedTracks.has(group.local_track_id);
            const isIgnored = ignoredTracks.has(ignoreKey(group));

            return (
              <div
                key={group.local_track_id}
                className={`rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1c1c28] p-4 transition-opacity duration-300 ${
                  isTrackApplied ? "opacity-40" : isIgnored ? "opacity-50" : ""
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTrackSelection(group.local_track_id)}
                    className="mt-1 w-4 h-4 accent-[#34d399] shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-[#e0e0e8] truncate" title={group.title}>
                      {group.title}
                    </div>
                    <div className="text-xs text-[#8888a0] mt-0.5 truncate" title={[group.artist, group.album].filter(Boolean).join(" · ")}>
                      {[group.artist, group.album].filter(Boolean).join(" · ") || group.local_path}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isIgnored ? (
                      <button
                        onClick={() => handleUnignore(group)}
                        className="text-[11px] text-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                      >
                        Unignore
                      </button>
                    ) : (
                      <button
                        onClick={() => handleIgnore(group)}
                        className="p-1 rounded hover:bg-[#24243a] text-[#5a5a6e] hover:text-[#8888a0] transition-colors"
                        title="Ignore this track"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => applyDiffs(group.diffs)}
                      className="text-[12px] font-medium px-2.5 py-1 rounded border border-[rgba(52,211,153,0.3)] text-[#34d399] hover:bg-[#34d399]/10 transition-colors whitespace-nowrap"
                    >
                      Apply all ({group.diffs.length})
                    </button>
                  </div>
                </div>

                {/* Field Diffs */}
                <div className="mt-3 space-y-2">
                  {group.diffs.map((diff) => {
                    const isFieldApplied = appliedDiffs.has(diffKey(diff));
                    const isArtwork = diff.field === "artwork";

                    if (isArtwork) {
                      return (
                        <div
                          key={diffKey(diff)}
                          className={`flex items-center gap-3 transition-opacity duration-200 ${isFieldApplied ? "opacity-40" : ""}`}
                        >
                          <span className="text-[11px] text-[#5a5a6e] uppercase font-medium w-14 shrink-0">ART</span>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-10 h-10 rounded bg-[#24243a] flex items-center justify-center shrink-0">
                              <span className="text-[9px] text-[#5a5a6e]">None</span>
                            </div>
                            <ArrowRight className="w-3 h-3 text-[#5a5a6e] shrink-0" />
                            {diff.spotify_value && (
                              <img src={diff.spotify_value} alt="" className="w-10 h-10 rounded object-cover shrink-0 border border-[#34d399]/30" />
                            )}
                          </div>
                          {isFieldApplied ? (
                            <Check className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
                          ) : (
                            <button onClick={() => applyDiffs([diff])} className="text-[11px] text-[#34d399] hover:underline shrink-0 px-1">
                              Apply
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={diffKey(diff)}
                        className={`flex items-center gap-2 transition-opacity duration-200 ${isFieldApplied ? "opacity-40" : ""}`}
                      >
                        <span className="text-[11px] text-[#5a5a6e] uppercase font-medium w-14 shrink-0">
                          {diff.field}
                        </span>
                        <span
                          className={`text-[12px] bg-[#f59e0b20] text-[#f59e0b] rounded px-1.5 py-0.5 truncate min-w-0 flex-1 ${
                            isFieldApplied ? "line-through" : ""
                          }`}
                          title={diff.local_value ?? "(empty)"}
                        >
                          {diff.local_value ?? "(empty)"}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#5a5a6e] shrink-0" />
                        <span
                          className={`text-[12px] bg-[#34d39920] text-[#34d399] rounded px-1.5 py-0.5 truncate min-w-0 flex-1 ${
                            isFieldApplied ? "line-through" : ""
                          }`}
                          title={diff.spotify_value ?? "(empty)"}
                        >
                          {diff.spotify_value ?? "(empty)"}
                        </span>
                        {isFieldApplied ? (
                          <Check className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
                        ) : (
                          <button
                            onClick={() => applyDiffs([diff])}
                            className="text-[11px] text-[#34d399] hover:underline shrink-0 px-1"
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
