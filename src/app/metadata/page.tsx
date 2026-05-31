"use client";

import { useState, useEffect } from "react";
import { DiffTable } from "@/components/metadata/diff-table";
import type { MetadataDiff } from "@/types";

export default function MetadataPage() {
  const [diffs, setDiffs] = useState<MetadataDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

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

  async function handleApply(selected: MetadataDiff[]) {
    setApplying(true);
    try {
      await fetch("/api/metadata/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffs: selected }),
      });
      await fetchDiffs();
    } catch {
      // Apply failed
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Metadata</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Metadata</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Compare and sync metadata between local files and Spotify (
          {diffs.length} differences)
        </p>
      </div>

      {diffs.length === 0 ? (
        <p className="text-muted-foreground">
          No metadata differences found. All matched tracks have consistent
          metadata.
        </p>
      ) : (
        <DiffTable diffs={diffs} onApply={handleApply} applying={applying} />
      )}
    </div>
  );
}
