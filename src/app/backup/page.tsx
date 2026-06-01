"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface BackupStatus {
  total_files: number;
  up_to_date: number;
  files_to_copy: number;
}

interface HistoryEntry {
  id: number;
  files_synced: number;
  files_new: number;
  files_failed: number;
  status: string;
  duration_ms: number | null;
  created_at: string;
}

interface Settings {
  music_source_path?: string;
  backup_dest_path?: string;
  [key: string]: string | undefined;
}

export default function BackupPage() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ copied: number; total: number; file: string } | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [statusRes, historyRes, settingsRes] = await Promise.all([
        fetch("/api/backup/status"),
        fetch("/api/backup/history"),
        fetch("/api/settings"),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus({
          total_files: data.total_files ?? 0,
          up_to_date: data.up_to_date ?? 0,
          files_to_copy: data.files_to_copy ?? 0,
        });
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history ?? []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }
    } catch {
      // fetch failed
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncProgress(null);
    const eventSource = new EventSource("/api/backup/progress");
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          eventSource.close();
          return;
        }
        if (data.copied != null && data.total != null) {
          const filename = (data.file ?? "").split(/[\\/]/).pop() ?? "";
          setSyncProgress({ copied: data.copied, total: data.total, file: filename });
        }
      } catch {}
    };
    try {
      await fetch("/api/backup/sync", { method: "POST" });
      await fetchAll();
    } catch {
      // sync failed
    } finally {
      eventSource.close();
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  const sourceFiles = status?.total_files ?? 0;
  const upToDate = status?.up_to_date ?? 0;
  const pending = status?.files_to_copy ?? 0;
  const pct = sourceFiles > 0 ? Math.round((upToDate / sourceFiles) * 100) : 0;

  if (loading) {
    return (
      <div>
        <h1 className="text-[22px] font-[800] text-[#e0e0e8] mb-4">Backup</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-[#34d399] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] font-[800] text-[#e0e0e8] mb-5">Backup</h1>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left Column */}
        <div className="flex-[3] min-w-0 space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              value={sourceFiles.toLocaleString()}
              label="SOURCE FILES"
              valueColor="#e0e0e8"
            />
            <StatCard
              value={upToDate.toLocaleString()}
              label="UP TO DATE"
              valueColor="#34d399"
            />
            <StatCard
              value={pending.toLocaleString()}
              label="PENDING"
              valueColor="#f59e0b"
            />
          </div>

          {/* Progress Bar */}
          <div>
            <div className="h-2 rounded bg-[#24243a] overflow-hidden">
              <div
                className="h-full rounded bg-[#34d399] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[12px] text-[#8888a0] mt-1.5">
              {pct}% backed up
            </p>
          </div>

          {/* Sync Now Button + Progress */}
          {syncing && syncProgress ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#e0e0e8] font-semibold">
                  Syncing... {syncProgress.copied} / {syncProgress.total}
                </span>
                <span className="text-[#8888a0] font-mono">
                  {syncProgress.total > 0 ? Math.round((syncProgress.copied / syncProgress.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#24243a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#34d399] rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress.total > 0 ? (syncProgress.copied / syncProgress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-[#5a5a6e] font-mono truncate">
                {syncProgress.file}
              </p>
            </div>
          ) : (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-5 py-2 bg-[#34d399] text-[#12121c] font-semibold rounded-[4px] disabled:opacity-60 transition-colors"
              style={{ boxShadow: "0 0 16px #34d39933" }}
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting sync...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync Now
                </>
              )}
            </button>
          )}

          {/* Configuration Card */}
          <div className="bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] rounded-[4px] p-4">
            <p className="text-[10px] uppercase font-bold tracking-[1.5px] text-[#5a5a6e] mb-3">
              Configuration
            </p>
            <div className="space-y-2.5">
              <ConfigRow
                label="Source path"
                value={settings.music_source_path || "Not configured"}
              />
              <ConfigRow
                label="Destination path"
                value={settings.backup_dest_path || "Not configured"}
              />
              <ConfigRow
                label="Total size"
                value={
                  sourceFiles > 0
                    ? `${sourceFiles.toLocaleString()} files`
                    : "-"
                }
              />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex-[2] min-w-0">
          <p className="text-[10px] uppercase font-bold tracking-[1.5px] text-[#5a5a6e] mb-3">
            Backup History
          </p>
          <div className="bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] rounded-[4px] max-h-[500px] overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-[13px] text-[#5a5a6e] p-4 text-center">
                No backup history yet.
              </p>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {history.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  valueColor,
}: {
  value: string;
  label: string;
  valueColor: string;
}) {
  return (
    <div className="bg-[#1c1c28] border border-[rgba(255,255,255,0.06)] rounded-[4px] p-4">
      <p
        className="text-[28px] font-mono font-[800] leading-tight"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase font-bold tracking-[1.5px] text-[#5a5a6e] mt-1">
        {label}
      </p>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-[#5a5a6e] shrink-0">{label}</span>
      <span className="text-[13px] font-mono text-[#e0e0e8] truncate text-right">
        {value}
      </span>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const isComplete = entry.status === "complete";
  const dotColor = isComplete ? "bg-[#34d399]" : "bg-[#f59e0b]";

  const dateStr = (() => {
    try {
      const d = new Date(entry.created_at);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return entry.created_at;
    }
  })();

  const durationStr =
    entry.duration_ms != null
      ? entry.duration_ms >= 1000
        ? `${(entry.duration_ms / 1000).toFixed(1)}s`
        : `${entry.duration_ms}ms`
      : "";

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dotColor}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[#e0e0e8]">{dateStr}</p>
        <p className="text-[12px] text-[#8888a0] mt-0.5">
          {entry.files_synced} synced &middot; {entry.files_new} new &middot;{" "}
          {entry.files_failed} failed
        </p>
      </div>
      {durationStr && (
        <span className="text-[12px] font-mono text-[#5a5a6e] shrink-0 mt-0.5">
          {durationStr}
        </span>
      )}
    </div>
  );
}
