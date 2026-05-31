"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FolderEntry {
  name: string;
  path: string;
}

interface FolderPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  currentPath?: string;
}

export function FolderPicker({ open, onClose, onSelect, currentPath }: FolderPickerProps) {
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [browsePath, setBrowsePath] = useState(currentPath || "");
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      browse(currentPath || "");
    }
  }, [open, currentPath]);

  async function browse(dirPath: string) {
    setLoading(true);
    try {
      const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
      const res = await fetch(`/api/browse${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setBrowsePath(data.path);
        setParent(data.parent);
      }
    } catch {
      // browse failed
    } finally {
      setLoading(false);
    }
  }

  function handleSelect() {
    if (browsePath) {
      onSelect(browsePath);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Folder</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground font-mono truncate px-3 py-2 bg-muted rounded">
          {browsePath || "Select a drive"}
        </div>

        <ScrollArea className="h-72 border rounded">
          <div className="p-1">
            {parent !== null && (
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm flex items-center gap-2"
                onClick={() => browse(parent)}
              >
                <span className="text-muted-foreground">..</span>
                <span className="text-muted-foreground">Up one level</span>
              </button>
            )}
            {loading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No subfolders</p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.path}
                  className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm"
                  onClick={() => browse(entry.path)}
                >
                  {entry.name}
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSelect} disabled={!browsePath}>Select This Folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
