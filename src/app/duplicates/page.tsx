"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  DuplicateCard,
  type DuplicateGroupData,
} from "@/components/duplicates/duplicate-card";

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await fetch("/api/duplicates");
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : data.groups ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  async function runDetection() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/duplicates", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setScanResult(`Found ${data.groups_found ?? 0} groups with ${data.total_duplicate_tracks ?? 0} tracks`);
      }
      await fetchGroups();
    } catch {
      setScanResult("Detection failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleResolve(
    groupId: number,
    action: string,
    keepId?: number
  ) {
    setResolving(true);
    try {
      await fetch("/api/duplicates/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId, action, keeper_track_id: keepId }),
      });
      await fetchGroups();
    } catch {
      // Resolve failed
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Duplicates</h2>
        <p className="text-[#94A3B8] text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC]">Duplicates</h2>
          <p className="text-[#94A3B8] text-sm mt-1">
            {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} found
            {groups.length > 0 &&
              ` — ${groups.reduce((sum, g) => sum + g.members.length, 0)} total tracks`}
          </p>
        </div>
        <Button
          onClick={runDetection}
          disabled={scanning}
          variant="outline"
          className="gap-2"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {scanning ? "Scanning..." : "Re-scan"}
        </Button>
      </div>

      {scanning && (
        <div className="space-y-2">
          <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
            <div className="h-full bg-[#22C55E] rounded-full animate-pulse w-full" />
          </div>
          <p className="text-xs text-[#64748B]">Scanning library for duplicates...</p>
        </div>
      )}

      {scanResult && !scanning && (
        <p className="text-sm text-[#22C55E]">{scanResult}</p>
      )}

      {groups.length === 0 && !scanning ? (
        <p className="text-[#64748B]">
          No duplicate groups found. Click Re-scan to check your library.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <DuplicateCard
              key={group.id}
              group={group}
              onResolve={handleResolve}
              resolving={resolving}
            />
          ))}
        </div>
      )}
    </div>
  );
}
