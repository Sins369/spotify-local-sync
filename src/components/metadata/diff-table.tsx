"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MetadataDiff } from "@/types";

interface DiffTableProps {
  diffs: MetadataDiff[];
  onApply: (selected: MetadataDiff[]) => void;
  applying: boolean;
}

export function DiffTable({ diffs, onApply, applying }: DiffTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function diffKey(d: MetadataDiff): string {
    return `${d.local_track_id}:${d.field}`;
  }

  function toggleOne(d: MetadataDiff) {
    const key = diffKey(d);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === diffs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(diffs.map(diffKey)));
    }
  }

  function handleApply() {
    const selectedDiffs = diffs.filter((d) => selected.has(diffKey(d)));
    onApply(selectedDiffs);
  }

  const allSelected = diffs.length > 0 && selected.size === diffs.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} of {diffs.length} selected
        </p>
        <Button
          onClick={handleApply}
          disabled={selected.size === 0 || applying}
          size="sm"
        >
          {applying ? "Applying..." : "Apply Selected"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
            </TableHead>
            <TableHead>Filename</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Local Value</TableHead>
            <TableHead>Spotify Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diffs.map((d) => {
            const key = diffKey(d);
            return (
              <TableRow key={key}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(key)}
                    onCheckedChange={() => toggleOne(d)}
                  />
                </TableCell>
                <TableCell
                  className="max-w-[200px] truncate"
                  title={d.local_path}
                >
                  {d.local_path.split(/[\\/]/).pop()}
                </TableCell>
                <TableCell className="capitalize">{d.field}</TableCell>
                <TableCell className="text-red-400">
                  {d.local_value ?? <span className="italic text-muted-foreground">empty</span>}
                </TableCell>
                <TableCell className="text-green-400">
                  {d.spotify_value ?? <span className="italic text-muted-foreground">empty</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
