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
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { BackupState } from "@/types";

interface BackupStatus {
  source_files: number;
  up_to_date: number;
  pending: number;
  pending_files: BackupState[];
}

export default function BackupPage() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/backup/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setProgress(0);
    try {
      const res = await fetch("/api/backup/sync", { method: "POST" });
      if (res.ok) {
        setProgress(100);
      }
      await fetchStatus();
    } catch {
      // Sync failed
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }

  const statCards = [
    { label: "Source Files", value: status?.source_files ?? 0 },
    { label: "Up to Date", value: status?.up_to_date ?? 0 },
    { label: "Pending", value: status?.pending ?? 0 },
  ];

  const progressPercent =
    status && status.source_files > 0
      ? Math.round((status.up_to_date / status.source_files) * 100)
      : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Backup</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Backup</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Sync your music library to a backup destination
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {s.value.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Progress value={syncing && progress !== null ? progress : progressPercent}>
          <ProgressLabel>Backup progress</ProgressLabel>
          <ProgressValue>
            {(formattedValue) => syncing && progress !== null ? `${progress}%` : `${progressPercent}%`}
          </ProgressValue>
        </Progress>
      </div>

      <Button onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync Now"}
      </Button>

      {status && status.pending_files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Pending Files</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status.pending_files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="max-w-[400px] truncate" title={file.source_path}>
                    {file.source_path.split(/[\\/]/).pop()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        file.status === "pending"
                          ? "secondary"
                          : file.status === "modified"
                            ? "outline"
                            : "destructive"
                      }
                    >
                      {file.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
