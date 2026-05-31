"use client";

import { useState, useEffect } from "react";
import {
  DuplicateCard,
  type DuplicateGroupData,
} from "@/components/duplicates/duplicate-card";

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await fetch("/api/duplicates");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ group_id: groupId, action, keep_id: keepId }),
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
        <h2 className="text-2xl font-bold">Duplicates</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Duplicates</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          No duplicate groups found. Run &quot;Check for Duplicates&quot; from
          the Dashboard.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <DuplicateCard
              key={group.group_id}
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
