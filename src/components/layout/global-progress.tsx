"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface BackupProgress {
  copied: number;
  total: number;
  file: string;
}

export function GlobalProgress() {
  const [backup, setBackup] = useState<BackupProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function connect() {
      if (esRef.current) return;
      const es = new EventSource("/api/backup/progress");
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.done) {
            setBackup(null);
            setDismissed(false);
            es.close();
            esRef.current = null;
            return;
          }
          if (data.copied != null && data.total != null) {
            setDismissed(false);
            setBackup({
              copied: data.copied,
              total: data.total,
              file: (data.file ?? "").split(/[\\/]/).pop() ?? "",
            });
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        retryRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  if (!backup || dismissed) return null;

  const pct = backup.total > 0 ? Math.round((backup.copied / backup.total) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="h-1 bg-[#24243a]">
        <div className="h-full bg-[#34d399] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="bg-[#161620] border-t border-[rgba(255,255,255,0.06)] px-4 py-2 flex items-center gap-4">
        <span className="text-[11px] text-[#34d399] font-semibold uppercase tracking-wider shrink-0">
          Backup
        </span>
        <span className="text-[12px] text-[#e0e0e8]">
          {backup.copied} / {backup.total} files
        </span>
        <span className="text-[11px] text-[#8888a0] font-mono">{pct}%</span>
        <span className="text-[11px] text-[#5a5a6e] font-mono truncate flex-1 min-w-0">
          {backup.file}
        </span>
        <Link href="/backup" className="text-[11px] text-[#34d399] hover:underline shrink-0">
          View
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/backup/sync", { method: "DELETE" });
            setBackup(null);
          }}
          className="text-[11px] text-[#e05566] hover:underline shrink-0"
        >
          Cancel
        </button>
        <button onClick={() => setDismissed(true)} className="text-[#5a5a6e] hover:text-[#8888a0] shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
