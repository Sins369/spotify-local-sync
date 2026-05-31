"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ScanStats {
  total_local_tracks: number;
  matched_tracks: number;
  spotify_tracks: number;
  unmatched_tracks: number;
  duplicate_groups: number;
  last_scan: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch("/api/scan/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Stats unavailable
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      if (action === "scan") {
        await fetch("/api/scan", { method: "POST" });
      } else if (action === "sync") {
        await fetch("/api/spotify/sync", { method: "POST" });
      } else if (action === "duplicates") {
        await fetch("/api/duplicates", { method: "POST" });
      }
      await fetchStats();
    } catch {
      // Action failed
    } finally {
      setActionLoading(null);
    }
  }

  const statCards = [
    { label: "Local Tracks", value: stats?.total_local_tracks ?? 0 },
    { label: "Matched", value: stats?.matched_tracks ?? 0 },
    { label: "Spotify Liked", value: stats?.spotify_tracks ?? 0 },
    { label: "Duplicates", value: stats?.duplicate_groups ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {stats?.last_scan
            ? `Last scan: ${new Date(stats.last_scan).toLocaleString()}`
            : "No scans yet"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {loading ? "-" : s.value.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => handleAction("scan")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "scan" ? "Scanning..." : "Scan Library"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleAction("sync")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "sync" ? "Syncing..." : "Sync Spotify"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAction("duplicates")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "duplicates"
            ? "Checking..."
            : "Check for Duplicates"}
        </Button>
      </div>
    </div>
  );
}
