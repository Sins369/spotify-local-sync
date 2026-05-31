"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Download,
  Check,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface DownloadRecord {
  id: number;
  spotify_track_id: number;
  status: string;
  source_user: string | null;
  filename: string | null;
  download_path: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDownloads = useCallback(async () => {
    try {
      const res = await fetch("/api/soulseek/queue");
      if (res.ok) {
        const data = await res.json();
        setDownloads(Array.isArray(data) ? data : data.downloads ?? []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 5000);
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  const active = downloads.filter((d) => d.status === "downloading");
  const completed = downloads.filter((d) => d.status === "complete");
  const failed = downloads.filter((d) => d.status === "failed");

  const statusIcon = (status: string) => {
    switch (status) {
      case "downloading": return <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin" />;
      case "complete": return <Check className="w-4 h-4 text-[#22C55E]" />;
      case "failed": return <X className="w-4 h-4 text-red-400" />;
      default: return <Download className="w-4 h-4 text-[#64748B]" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "downloading": return <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px]">Downloading</Badge>;
      case "complete": return <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px]">Complete</Badge>;
      case "failed": return <Badge className="bg-red-500/20 text-red-400 text-[10px]">Failed</Badge>;
      default: return <Badge className="bg-[#1E293B] text-[#94A3B8] text-[10px]">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Downloads</h2>
        <p className="text-[#94A3B8] text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC]">Downloads</h2>
          <p className="text-[#94A3B8] text-sm mt-1">
            {active.length > 0 && `${active.length} downloading, `}
            {completed.length} completed{failed.length > 0 && `, ${failed.length} failed`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDownloads}
          className="gap-2 border-[#334155]"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0F172A] border-[#334155]">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 text-[#22C55E]" />
            <div>
              <p className="text-2xl font-bold text-[#F8FAFC]">{active.length}</p>
              <p className="text-xs text-[#94A3B8]">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#334155]">
          <CardContent className="flex items-center gap-3 py-4">
            <Check className="w-5 h-5 text-[#22C55E]" />
            <div>
              <p className="text-2xl font-bold text-[#F8FAFC]">{completed.length}</p>
              <p className="text-xs text-[#94A3B8]">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#334155]">
          <CardContent className="flex items-center gap-3 py-4">
            <X className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-[#F8FAFC]">{failed.length}</p>
              <p className="text-xs text-[#94A3B8]">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {downloads.length === 0 ? (
        <Card className="bg-[#0F172A] border-[#334155]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Download className="w-10 h-10 text-[#334155] mb-3" />
            <p className="text-[#64748B]">No downloads yet</p>
            <p className="text-xs text-[#475569] mt-1">Go to Sync to search and download tracks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {downloads.map((dl) => (
            <Card key={dl.id} className="bg-[#0F172A] border-[#334155]">
              <CardContent className="flex items-center gap-4 py-3">
                {statusIcon(dl.status)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F8FAFC] truncate">
                    {dl.title ?? dl.filename ?? "Unknown"}
                  </p>
                  <p className="text-xs text-[#94A3B8] truncate">
                    {dl.artist ?? "Unknown"}{dl.album ? ` — ${dl.album}` : ""}
                  </p>
                  {dl.error && (
                    <p className="text-xs text-red-400 mt-1">{dl.error}</p>
                  )}
                  {dl.download_path && (
                    <p className="text-[10px] font-mono text-[#475569] truncate mt-1" title={dl.download_path}>
                      {dl.download_path.split(/[\\/]/).slice(-3).join("/")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {statusBadge(dl.status)}
                  {dl.source_user && (
                    <span className="text-[10px] text-[#475569]">from {dl.source_user}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
