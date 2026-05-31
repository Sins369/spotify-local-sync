"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DuplicateMember {
  id: number;
  group_id: number;
  local_track_id: number;
  is_keeper: number;
  quality_score: number | null;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  codec: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
}

export interface DuplicateGroupData {
  id: number;
  resolution: string | null;
  members: DuplicateMember[];
}

interface DuplicateCardProps {
  group: DuplicateGroupData;
  onResolve: (groupId: number, action: string, keepId?: number) => void;
  resolving: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBitrate(bitrate: number): string {
  if (bitrate > 10000) return `${Math.round(bitrate / 1000)} kbps`;
  return `${bitrate} kbps`;
}

export function DuplicateCard({ group, onResolve, resolving }: DuplicateCardProps) {
  const sorted = [...group.members].sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
  const bestId = sorted[0]?.local_track_id;
  const title = sorted[0]?.title ?? "Unknown";
  const artist = sorted[0]?.artist ?? "Unknown";

  return (
    <Card className="bg-[#0F172A] border-[#334155]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-[#F8FAFC]">
          {title} <span className="text-[#94A3B8] font-normal">by {artist}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((member) => {
          const isBest = member.local_track_id === bestId;
          const filename = member.path.split(/[\\/]/).pop() ?? member.path;
          const folder = member.path.split(/[\\/]/).slice(-3, -1).join("/");

          return (
            <div
              key={member.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border p-3",
                isBest
                  ? "border-[#22C55E]/40 bg-[#22C55E]/5"
                  : "border-[#334155] bg-[#020617]"
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-mono text-[#94A3B8] truncate" title={member.path}>
                  {folder}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  {member.codec && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {member.codec}
                    </Badge>
                  )}
                  {member.bitrate && <span>{formatBitrate(member.bitrate)}</span>}
                  {member.size_bytes && <span>{formatSize(member.size_bytes)}</span>}
                  {isBest && (
                    <Badge className="bg-[#22C55E]/20 text-[#22C55E] text-[10px] px-1.5 py-0">
                      Best
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                disabled={resolving}
                onClick={() => onResolve(group.id, "keep_one", member.local_track_id)}
              >
                Keep
              </Button>
            </div>
          );
        })}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="text-xs"
            disabled={resolving}
            onClick={() => onResolve(group.id, "keep_one", bestId)}
          >
            Keep Best
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={resolving}
            onClick={() => onResolve(group.id, "keep_all")}
          >
            Keep All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
