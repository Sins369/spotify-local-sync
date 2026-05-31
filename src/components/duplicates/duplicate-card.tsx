"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LocalTrack } from "@/types";

export interface DuplicateGroupData {
  group_id: number;
  members: Array<{
    local_track_id: number;
    quality_score: number | null;
    is_keeper: number;
    track: LocalTrack;
  }>;
  recommended_id: number | null;
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

export function DuplicateCard({
  group,
  onResolve,
  resolving,
}: DuplicateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Duplicate Group #{group.group_id}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.members.map((member) => {
          const isRecommended = member.local_track_id === group.recommended_id;
          return (
            <div
              key={member.local_track_id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-md border p-3",
                isRecommended && "border-green-500/50 bg-green-500/5"
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className="text-sm truncate"
                  title={member.track.path}
                >
                  {member.track.path.split(/[\\/]/).pop()}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {member.track.format && (
                    <Badge variant="secondary">{member.track.format}</Badge>
                  )}
                  {member.track.bitrate && (
                    <span>{member.track.bitrate} kbps</span>
                  )}
                  <span>{formatSize(member.track.size)}</span>
                  {isRecommended && (
                    <Badge variant="default">Recommended</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="xs"
                disabled={resolving}
                onClick={() =>
                  onResolve(group.group_id, "keep_one", member.local_track_id)
                }
              >
                Keep This
              </Button>
            </div>
          );
        })}

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            disabled={resolving || !group.recommended_id}
            onClick={() => onResolve(group.group_id, "keep_best")}
          >
            Keep Best
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={resolving}
            onClick={() => onResolve(group.group_id, "keep_all")}
          >
            Keep All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
